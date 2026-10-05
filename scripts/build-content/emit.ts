/**
 * Emit bundle JSON yang di-bundle ke app + manifest checksum (ARCHITECTURE.md § 6).
 * Output TIDAK BOLEH diedit manual (RULES.md § 7).
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { ATTRIBUTIONS, RECITERS } from "./sources";
import type { ValidatedSurah } from "./validate";

const OUT_DIR = path.resolve(process.cwd(), "src/data/content");

export type Manifest = {
  version: string;
  generatedAt: string;
  surahCount: number;
  ayahCount: number;
  checksums: Record<string, string>;
  attributions: string[];
};

export type BundleShape = {
  surahMetadata: {
    id: number;
    nameArabic: string;
    nameLatin: string;
    meaningId: string;
    ayahCount: number;
    revelation: "mekkah" | "madinah";
  }[];
  quranUthmani: Record<string, Record<string, string>>;
  translationId: Record<string, Record<string, string>>;
  reciters: typeof RECITERS;
};

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function emitBundle(surahs: ValidatedSurah[]): Promise<Manifest> {
  const surahMetadata = surahs.map(({ meta }) => meta);
  const quranUthmani: BundleShape["quranUthmani"] = {};
  const translationId: BundleShape["translationId"] = {};

  let totalAyahs = 0;
  for (const s of surahs) {
    const surahKey = String(s.meta.id);
    quranUthmani[surahKey] = {};
    translationId[surahKey] = {};
    s.arabic.forEach((text, i) => {
      quranUthmani[surahKey]![String(i + 1)] = text;
    });
    s.translation.forEach((text, i) => {
      translationId[surahKey]![String(i + 1)] = text;
    });
    totalAyahs += s.arabic.length;
  }

  const files: Record<string, string> = {
    "surah-metadata.json": JSON.stringify(surahMetadata),
    "quran-uthmani.json": JSON.stringify(quranUthmani),
    "translation-id.json": JSON.stringify(translationId),
    "audio-reciters.json": JSON.stringify(RECITERS),
  };

  await fs.mkdir(OUT_DIR, { recursive: true });
  const checksums: Record<string, string> = {};
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(OUT_DIR, name), content, "utf8");
    checksums[name] = sha256(content);
  }

  const manifest: Manifest = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    surahCount: surahs.length,
    ayahCount: totalAyahs,
    checksums,
    attributions: [...ATTRIBUTIONS],
  };
  await fs.writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  return manifest;
}
