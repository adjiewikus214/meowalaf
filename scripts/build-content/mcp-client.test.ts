import { describe, expect, it } from "vitest";

import { McpClient, McpError, type FetchLike, type McpClientOptions } from "./mcp-client";
import { MCP_TOOLS } from "./mcp-tools";

type RpcBody = Record<string, unknown>;
type Handler = (body: RpcBody) => unknown | undefined;

/** Fake transport: merekam request, membalas sesuai handler. Tanpa jaringan (RULES § 11). */
function makeFakeFetch(handlers: Handler[]): { fetchImpl: FetchLike; requests: RpcBody[] } {
  const requests: RpcBody[] = [];
  const fetchImpl: FetchLike = async (_url, init) => {
    const body = JSON.parse(String(init.body)) as RpcBody;
    requests.push(body);
    if (body["method"] === "notifications/initialized") {
      // Server asli membalas 200 dengan body non-RPC; client mengabaikannya.
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    for (const handler of handlers) {
      const out = handler(body);
      if (out !== undefined) {
        return new Response(JSON.stringify(out), { status: 200 });
      }
    }
    throw new Error(`Tidak ada handler untuk method: ${String(body["method"])}`);
  };
  return { fetchImpl, requests };
}

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function okHandlers(): Handler[] {
  const ayahJson = JSON.stringify({ number: 1, text: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ" });
  return [
    (body) => (body["method"] === "initialize" ? rpcResult(body["id"], { serverInfo: { name: "fake" } }) : undefined),
    (body) =>
      body["method"] === "tools/list" ? rpcResult(body["id"], { tools: [{ name: "get_ayah" }] }) : undefined,
    (body) =>
      body["method"] === "tools/call"
        ? rpcResult(body["id"], { content: [{ type: "text", text: ayahJson }] })
        : undefined,
  ];
}

function newClient(fetchImpl: FetchLike, extra: Partial<McpClientOptions> = {}): McpClient {
  return new McpClient({ url: "http://fake", fetchImpl, backoffMs: 1, ...extra });
}

describe("McpClient", () => {
  it("handshake: initialize → notifications/initialized → tools/call", async () => {
    const { fetchImpl, requests } = makeFakeFetch(okHandlers());
    const client = newClient(fetchImpl);
    await client.callToolByKey("getAyah", { reference: "1:1" });
    expect(requests.map((r) => r["method"])).toEqual([
      "initialize",
      "notifications/initialized",
      "tools/call",
    ]);
  });

  it("handshake hanya sekali untuk banyak call (idempoten)", async () => {
    const { fetchImpl, requests } = makeFakeFetch(okHandlers());
    const client = newClient(fetchImpl);
    await client.callToolByKey("getAyah", { reference: "1:1" });
    await client.callToolByKey("getSurahsList", {});
    expect(requests.filter((r) => r["method"] === "initialize")).toHaveLength(1);
    expect(requests.filter((r) => r["method"] === "tools/call")).toHaveLength(2);
  });

  it("callToolByKey memakai nama tool ter-pin; callToolJson mem-parse JSON", async () => {
    const { fetchImpl, requests } = makeFakeFetch(okHandlers());
    const client = newClient(fetchImpl);
    const parsed = await client.callToolJson<Record<string, unknown>>("getAyah", { reference: "1:1" });
    expect(parsed["text"]).toContain("بِسْمِ");
    const call = requests.find((r) => r["method"] === "tools/call") as
      | { params?: { name?: string } }
      | undefined;
    expect(call?.params?.name).toBe(MCP_TOOLS.getAyah);
  });

  it("respons SSE (baris data:) tetap ter-parse", async () => {
    const fetchImpl: FetchLike = async (_url, init) => {
      const body = JSON.parse(String(init.body)) as RpcBody;
      if (body["method"] === "initialize") {
        return new Response(JSON.stringify(rpcResult(body["id"], {})), { status: 200 });
      }
      const payload = rpcResult(body["id"], {
        content: [{ type: "text", text: JSON.stringify({ number: 1 }) }],
      });
      const sse = `event: message\ndata: ${JSON.stringify(payload)}\n\n`;
      return new Response(sse, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    };
    const client = newClient(fetchImpl);
    const parsed = await client.callToolJson<Record<string, unknown>>("getAyah", {});
    expect(parsed["number"]).toBe(1);
  });

  it("HTTP 500 pada tools/call pertama → retry berhasil, handshake tidak diulang", async () => {
    const requests: RpcBody[] = [];
    let callAttempts = 0;
    const fetchImpl: FetchLike = async (_url, init) => {
      const body = JSON.parse(String(init.body)) as RpcBody;
      requests.push(body);
      if (body["method"] === "notifications/initialized") {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (body["method"] === "tools/call") {
        callAttempts += 1;
        if (callAttempts === 1) return new Response("boom", { status: 500 });
      }
      for (const handler of okHandlers()) {
        const out = handler(body);
        if (out !== undefined) return new Response(JSON.stringify(out), { status: 200 });
      }
      throw new Error("no handler");
    };
    const client = newClient(fetchImpl);
    const parsed = await client.callToolJson<Record<string, unknown>>("getAyah", {});
    expect(parsed["number"]).toBe(1);
    expect(requests.filter((r) => r["method"] === "initialize")).toHaveLength(1);
    expect(callAttempts).toBe(2);
  });

  it("error RPC → McpError berisi pesan server", async () => {
    const { fetchImpl } = makeFakeFetch([
      (body) =>
        body["method"] === "initialize"
          ? { jsonrpc: "2.0", id: body["id"], error: { code: -32601, message: "Method not found" } }
          : undefined,
    ]);
    const client = newClient(fetchImpl, { retries: 0 });
    await expect(client.callToolByKey("getAyah", {})).rejects.toThrow(/Method not found/);
  });

  it("timeout ketika transport menggantung", async () => {
    const fetchImpl: FetchLike = () => new Promise<Response>(() => undefined);
    const client = newClient(fetchImpl, { timeoutMs: 50, retries: 0 });
    await expect(client.callToolByKey("getAyah", {})).rejects.toThrow(/Timeout MCP/);
  });

  it("content kosong → McpError", async () => {
    const { fetchImpl } = makeFakeFetch([
      (body) => (body["method"] === "initialize" ? rpcResult(body["id"], {}) : undefined),
      (body) => (body["method"] === "tools/call" ? rpcResult(body["id"], { content: [] }) : undefined),
    ]);
    const client = newClient(fetchImpl, { retries: 0 });
    await expect(client.callToolByKey("getAyah", {})).rejects.toThrow(McpError);
  });

  it("hasil call bukan JSON → McpError 'tidak mengembalikan JSON valid'", async () => {
    const { fetchImpl } = makeFakeFetch([
      (body) => (body["method"] === "initialize" ? rpcResult(body["id"], {}) : undefined),
      (body) =>
        body["method"] === "tools/call"
          ? rpcResult(body["id"], { content: [{ type: "text", text: "bukan json" }] })
          : undefined,
    ]);
    const client = newClient(fetchImpl, { retries: 0 });
    await expect(client.callToolJson("getAyah", {})).rejects.toThrow(/JSON valid/);
  });

  it("listTools mengembalikan daftar nama tool", async () => {
    const { fetchImpl } = makeFakeFetch(okHandlers());
    const client = newClient(fetchImpl);
    const tools = await client.listTools();
    expect(tools).toEqual([{ name: "get_ayah" }]);
  });
});
