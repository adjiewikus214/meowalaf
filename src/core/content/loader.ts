/**
 * Owner: core/content. Loader & validasi bundle TEKS Quran (Uthmani + terjemahan).
 * Boleh di-import features/ dan app/; TIDAK meng-import keduanya.
 *
 * Modul ini sengaja BERAT (~2,6 MB mentah) dan tidak boleh masuk jalur startup:
 * metadata surah/qari ada di `meta.ts` (kecil, selalu di bundle awal). Yang mengimpor
 * modul ini hanya layar yang benar-benar menampilkan ayat (materi lesson, mushaf),
 * supaya teks Quran bisa datang sebagai chunk sendiri — lihat `prefetchQuranText()`.
 *
 * RULES § 7.3: ayat tidak boleh tampil setengah jadi. `getSurahAyahs` karena itu
 * BERHENTI (bukan lanjut dengan teks kosong) begitu satu pasangan ayat hilang.
 */
import { z } from "zod";

import quranJson from "../../data/content/quran-uthmani.json";
import translationJson from "../../data/content/translation-id.json";

import { getSurahMeta, type AyahContent } from "./meta";
import { registerAyahSource } from "./ayah-source";

const quranSchema = z.record(z.string(), z.record(z.string(), z.string().min(1)));

function parseOrThrow<T>(label: string, schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new Error(`Bundle konten tidak valid (${label}): ${first?.message ?? "unknown"}`);
  }
  return result.data;
}

export const quranUthmani = parseOrThrow("quran-uthmani", quranSchema, quranJson);
export const translationId = parseOrThrow("translation-id", quranSchema, translationJson);

export { getSurahMeta };
export type { AyahContent };

/** Ayat-ayat sebuah surah (1-indexed ayahNumber). */
export function getSurahAyahs(surahId: number): AyahContent[] {
  const arabicMap = quranUthmani[String(surahId)];
  const translationMap = translationId[String(surahId)];
  const meta = getSurahMeta(surahId);
  if (arabicMap === undefined || translationMap === undefined || meta === undefined) {
    return [];
  }
  const ayahs: AyahContent[] = [];
  for (let n = 1; n <= meta.ayahCount; n++) {
    const arabic = arabicMap[String(n)];
    const translation = translationMap[String(n)];
    if (arabic === undefined || translation === undefined) {
      break; // bundle rusak sebagian - jangan tampilkan ayat tanpa pasangan (RULES § 7.3)
    }
    ayahs.push({ surahId, ayahNumber: n, arabic, translation });
  }
  return ayahs;
}

// Modul ini didaftarkan sebagai sumber ayat begitu dimuat, supaya modul pure
// (generator soal, panel materi) bisa membacanya tanpa meng-import modul 2,6 MB ini.
registerAyahSource(getSurahAyahs);

