/**
 * Owner: scripts/build-content. Emit bundle glos per kata (ADR-006):
 * `src/data/content/word-gloss-juz30.json` + checksum & atribusi QUL dicatat di
 * manifest (menimpa manifest yang ada tanpa menyentuh checksum file lain — RULES
 * § 7.2). Output TIDAK BOLEH diedit manual (RULES § 7.1).
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { ValidatedGlossData } from "./word-gloss-validate";

const OUT_DIR = path.resolve(process.cwd(), "src/data/content");
export const WORD_GLOSS_FILE = "word-gloss-juz30.json";

export const QUL_ATTRIBUTION =
  "Glos per kata bahasa Indonesia: QUL (Tarteel) resource #96 \"Indonesian wbw translation\" (qul.tarteel.ai) — lisensi per-resource QUL, akses 2026-10-01";

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function emitWordGloss(
  data: ValidatedGlossData,
  surahIds: readonly number[],
  options: { sourceFile?: string } = {},
): Promise<void> {
  const payload = {
    version: "1.0.0",
    source: "qul-tarteel-96",
    sourceFile: options.sourceFile,
    generatedAt: new Date().toISOString(),
    scope: { description: "Al-Fatihah + Juz 30", surahIds },
    glosses: data.glosses,
  };
  const content = JSON.stringify(payload);
  await fs.writeFile(path.join(OUT_DIR, WORD_GLOSS_FILE), content, "utf8");

  // Perbarui manifest yang ada: tambah/ubah entri word-gloss, jaga checksum file lain.
  const manifestPath = path.join(OUT_DIR, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as {
    version: string;
    generatedAt: string;
    surahCount: number;
    ayahCount: number;
    checksums: Record<string, string>;
    attributions: string[];
  };
  manifest.checksums[WORD_GLOSS_FILE] = sha256(content);
  if (!manifest.attributions.includes(QUL_ATTRIBUTION)) {
    manifest.attributions.push(QUL_ATTRIBUTION);
  }
  manifest.generatedAt = new Date().toISOString();
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
}
