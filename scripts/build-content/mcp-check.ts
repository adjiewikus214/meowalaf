/**
 * Smoke test QuranHub MCP (ADR-005 Langkah 1): verifikasi endpoint hidup,
 * semua nama tool ter-pin ada di `tools/list`, dan satu `tools/call` nyata
 * mengembalikan data valid. Jalankan: `npm run content:mcp-check`.
 * Gagal = exit non-zero — dipakai CI/manual sebagai deteksi dini perubahan server.
 */
import { McpClient, McpError } from "./mcp-client";
import { MCP_TOOLS, resolveMcpUrl } from "./mcp-tools";

async function main(): Promise<void> {
  const url = resolveMcpUrl();
  console.log(`▶ QuranHub MCP smoke test → ${url}`);
  const client = new McpClient({ url, timeoutMs: 20_000, retries: 2 });

  const tools = await client.listTools();
  const names = new Set(tools.map((t) => t.name));
  console.log(`✔ handshake & tools/list: ${tools.length} tool terdaftar`);

  const missing = Object.entries(MCP_TOOLS).filter(([, name]) => !names.has(name));
  if (missing.length > 0) {
    console.error(`✖ ${missing.length} nama tool ter-pin TIDAK ada di server (docs bisa jadi usang):`);
    for (const [key, name] of missing) {
      console.error(`  - ${key}: ${name}`);
    }
    process.exit(1);
  }
  console.log(`✔ ${Object.keys(MCP_TOOLS).length} nama tool ter-pin semuanya tersedia`);

  const ayahJson = await client.callToolJson<{ number?: number; text?: string }>("getAyahByEdition", {
    reference: "1:1",
    editionIdentifier: "quran-uthmani",
  });
  if (typeof ayahJson.text !== "string" || ayahJson.text.trim() === "") {
    throw new McpError("get_ayah 1:1 tidak mengembalikan teks");
  }
  console.log(`✔ tools/call get_ayah 1:1 (quran-uthmani): "${ayahJson.text.slice(0, 40)}..."`);
  console.log("✔ QuranHub MCP siap dipakai pipeline (ADR-005 Langkah 2).");
}

main().catch((error: unknown) => {
  console.error(`✖ MCP smoke test gagal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
