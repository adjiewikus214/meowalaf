/**
 * Owner: scripts/build-content. Klien JSON-RPC-over-HTTP minimal untuk QuranHub MCP
 * (ADR-005): handshake `initialize` → `notifications/initialized` → `tools/call` /
 * `tools/list`. Transport `fetch` dapat disuntik agar test berjalan tanpa jaringan.
 * Pola handshake & toleransi respons SSE hasil probe langsung ke server (2026-10-01).
 */
import { MCP_TOOLS, resolveMcpUrl, type McpToolKey } from "./mcp-tools";

export const MCP_PROTOCOL_VERSION = "2025-03-26";
const CLIENT_INFO = { name: "ayatin-build-content", version: "0.1.0" } as const;

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 250;

/** Error transport/protokol MCP — dipisah agar pemanggil bisa fail-soft (ADR-005). */
export class McpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpError";
  }
}

/** Fungsi fetch — abstraksi transport untuk testing tanpa jaringan. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export type McpClientOptions = {
  url?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  retries?: number;
  /** Jeda antar percobaan ulang — kecilkan di test. */
  backoffMs?: number;
};

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: number | string;
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id?: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

function extractJson(payload: string): JsonRpcResponse | null {
  const trimmed = payload.trim();
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed) as JsonRpcResponse;
    } catch {
      return null;
    }
  }
  // Server kadang membalas SSE (`event: message\ndata: {...}`) walau diminta JSON.
  const dataLine = trimmed
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("data:"));
  if (dataLine !== undefined) {
    try {
      return JSON.parse(dataLine.slice(5).trim()) as JsonRpcResponse;
    } catch {
      return null;
    }
  }
  return null;
}

export class McpClient {
  private readonly url: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly backoffMs: number;
  private initialized = false;

  constructor(options: McpClientOptions = {}) {
    this.url = options.url ?? resolveMcpUrl();
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retries = options.retries ?? DEFAULT_RETRIES;
    this.backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;
  }

  private async rpc(
    body: JsonRpcRequest | { jsonrpc: "2.0"; method: string; params?: unknown },
    expectResponse: true,
  ): Promise<JsonRpcResponse>;
  private async rpc(body: { jsonrpc: "2.0"; method: string; params?: unknown }, expectResponse: false): Promise<void>;
  private async rpc(
    body: JsonRpcRequest | { jsonrpc: "2.0"; method: string; params?: unknown },
    expectResponse: boolean,
  ): Promise<JsonRpcResponse | void> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.backoffMs * attempt));
      }
      try {
        const payload = JSON.stringify(body);
        const res = await this.withTimeout(
          this.fetchImpl(this.url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
            body: payload,
          }),
        );
        if (!res.ok) {
          throw new McpError(`HTTP ${res.status} dari ${this.url}`);
        }
        if (!expectResponse) {
          return; // notification: cukup pastikan terkirim, body diabaikan
        }
        const text = await res.text();
        const parsed = extractJson(text);
        if (parsed === null) {
          throw new McpError(`Respons bukan JSON-RPC valid: ${text.slice(0, 120)}`);
        }
        if (parsed.error !== undefined) {
          throw new McpError(`RPC error ${parsed.error.code}: ${parsed.error.message}`);
        }
        return expectResponse ? parsed : undefined;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new McpError("Request MCP gagal tanpa pesan error");
  }

  private async withTimeout(promise: Promise<Response>): Promise<Response> {
    return await Promise.race([
      promise,
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new McpError(`Timeout MCP ${this.timeoutMs}ms`)), this.timeoutMs),
      ),
    ]);
  }

  /** Handshake sekali per client; aman dipanggil ulang (idempoten). */
  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await this.rpc(
      {
        jsonrpc: "2.0",
        id: 0,
        method: "initialize",
        params: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {}, clientInfo: CLIENT_INFO },
      },
      true,
    );
    await this.rpc({ jsonrpc: "2.0", method: "notifications/initialized" }, false);
    this.initialized = true;
  }

  /** Daftar tool dari server — dipakai mcp-check untuk memverifikasi nama ter-pin. */
  async listTools(): Promise<Array<{ name: string; description?: string }>> {
    await this.ensureInitialized();
    const res = await this.rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, true);
    const result = res.result as { tools?: Array<{ name: string; description?: string }> } | undefined;
    const tools = result?.tools;
    if (!Array.isArray(tools)) {
      throw new McpError("tools/list tidak mengembalikan daftar tool");
    }
    return tools;
  }

  /** Panggil tool by key ter-pin; kembalikan teks konten hasil call. */
  async callToolByKey(key: McpToolKey, args: Record<string, unknown> = {}): Promise<string> {
    const name = MCP_TOOLS[key];
    return await this.callTool(name, args);
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<string> {
    await this.ensureInitialized();
    const res = await this.rpc(
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } },
      true,
    );
    const result = res.result as { content?: Array<{ type?: string; text?: string }>; isError?: boolean } | undefined;
    if (result?.isError === true) {
      const detail = result.content?.map((c) => c.text ?? "").join("\n") ?? "(tanpa detail)";
      throw new McpError(`Tool ${name} gagal: ${detail.slice(0, 300)}`);
    }
    const text = result?.content?.map((c) => c.text ?? "").join("\n") ?? "";
    if (text === "") {
      throw new McpError(`Tool ${name} mengembalikan konten kosong`);
    }
    return text;
  }

  /** Panggil tool lalu parse JSON-nya (mayoritas tool QuranHub membalas JSON string). */
  async callToolJson<T>(key: McpToolKey, args: Record<string, unknown> = {}): Promise<T> {
    const text = await this.callToolByKey(key, args);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new McpError(`Tool ${MCP_TOOLS[key]} tidak mengembalikan JSON valid`);
    }
  }
}
