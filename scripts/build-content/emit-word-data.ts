/**
 * Owner: scripts/build-content. Emit word-data bundle (ADR-005 Langkah 2):
 * `src/data/content/word-data-juz30.json` + checksum & atribusi dicatat di manifest
 * (menimpa manifest yang ada tanpa menyentuh checksum file inti lain — RULES § 7.2).
 * Output TIDAK BOLEH diedit manual (RULES § 7.1).
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { ValidatedWordData } from "./word-validate";

const OUT_DIR = path.resolve(process.cwd(), "src/data/content");
export const WORD_DATA_FILE = "word-data-juz30.json";

const MCP_ATTRIBUTION =
  "Segmentasi kata & akar kata (morfologi): QuranHub MCP (api.qurani.ai, data quran.com v4) — akses 2026-10-01";

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function emitWordData(data: ValidatedWordData, surahIds: readonly number[]): Promise<void> {
  const payload = {
    version: "1.0.0",
    source: "quranhub-mcp",
    generatedAt: new Date().toISOString(),
    scope: { description: "Al-Fatihah + Juz 30", surahIds },
    words: data.words,
    roots: data.roots,
  };
  const content = JSON.stringify(payload);
  await fs.writeFile(path.join(OUT_DIR, WORD_DATA_FILE), content, "utf8");

  // Perbarui manifest yang ada: tambah/ubah entri word-data, jaga checksum file inti.
  const manifestPath = path.join(OUT_DIR, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as {
    version: string;
    generatedAt: string;
    surahCount: number;
    ayahCount: number;
    checksums: Record<string, string>;
    attributions: string[];
  };
  manifest.checksums[WORD_DATA_FILE] = sha256(content);
  if (!manifest.attributions.includes(MCP_ATTRIBUTION)) {
    manifest.attributions.push(MCP_ATTRIBUTION);
  }
  manifest.generatedAt = new Date().toISOString();
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
}
