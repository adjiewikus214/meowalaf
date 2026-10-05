/**
 * Owner: core/content. Metadata bundle yang KECIL: 114 metadata surah, daftar qari,
 * manifest. Boleh di-import features/ dan app/; TIDAK meng-import keduanya.
 *
 * Kenapa modul ini dipisah dari `loader.ts`: metadata cuma ~24 KB, sedangkan teks
 * Uthmani + terjemahan 2,6 MB. Kalau keduanya satu modul, modul itu ikut masuk ke
 * bundle Awal yang di-parse sebelum layar Home muncul — dan itu yang diukur sebagai
 * "startup" di docs/PERF.md. Pemisahan ini membuat teks Quran bisa di-muat sebagai
 * chunk terpisah saat dibutuhkan layar materi/mushaf (lihat `prefetchQuranText`).
 *
 * Aturan: modul ini TIDAK BOLEH meng-import `loader.ts` (teksteks). Jangan dibalik.
 */
import { z } from "zod";

import recitersJson from "../../data/content/audio-reciters.json";
import manifestJson from "../../data/content/manifest.json";
import surahMetaJson from "../../data/content/surah-metadata.json";

export type Reciter = z.infer<typeof reciterSchema>;
export type SurahMeta = z.infer<typeof surahMetaSchema>;

const surahMetaSchema = z.object({
  id: z.number().int().min(1).max(114),
  nameArabic: z.string().min(1),
  nameLatin: z.string().min(1),
  meaningId: z.string(),
  ayahCount: z.number().int().min(3).max(286),
  revelation: z.enum(["mekkah", "madinah"]),
});

const reciterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  baseUrl: z.string().url(),
});

const manifestSchema = z.object({
  version: z.string(),
  generatedAt: z.string(),
  surahCount: z.number(),
  ayahCount: z.number(),
  checksums: z.record(z.string(), z.string()),
  attributions: z.array(z.string()),
});

const surahMetaList = z.array(surahMetaSchema).length(114);
const reciterList = z.array(reciterSchema).min(1);

function parseOrThrow<T>(label: string, schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new Error(`Bundle konten tidak valid (${label}): ${first?.message ?? "unknown"}`);
  }
  return result.data;
}

export const surahMetadata: readonly SurahMeta[] = parseOrThrow("surah-metadata", surahMetaList, surahMetaJson);
export const reciters: readonly Reciter[] = parseOrThrow("audio-reciters", reciterList, recitersJson);
export const contentManifest = parseOrThrow("manifest", manifestSchema, manifestJson);

export const DEFAULT_RECITER_ID = reciters[0]?.id ?? "juhany";

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

/** URL audio per ayat untuk seorang qari. */
export function ayahAudioUrl(reciterId: string, surahId: number, ayahNumber: number): string {
  const reciter = reciters.find((r) => r.id === reciterId) ?? reciters[0];
  if (reciter === undefined) {
    throw new Error(`Qari tidak dikenal: ${reciterId}`);
  }
  return `${reciter.baseUrl}/${pad3(surahId)}${pad3(ayahNumber)}.mp3`;
}

export function getSurahMeta(surahId: number): SurahMeta | undefined {
  return surahMetadata.find((s) => s.id === surahId);
}

export type AyahContent = {
  surahId: number;
  ayahNumber: number;
  arabic: string;
  translation: string;
};