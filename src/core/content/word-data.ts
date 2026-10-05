/**
 * Owner: core/content. Loader word-data bundle (segmentasi kata & akar, ADR-005)
 * dengan validasi zod + checksum vs manifest. Boleh di-import features/ dan app/;
 * TIDAK meng-import keduanya. Output pipeline — JANGAN edit JSON manual (RULES § 7).
 */
import { z } from "zod";

import wordDataJson from "../../data/content/word-data-juz30.json";

const wordTokenSchema = z.object({
  pos: z.number().int().min(1),
  text: z.string().min(1),
  location: z.string().regex(/^\d+:\d+:\d+$/),
});

const wordRootTokenSchema = z.object({
  pos: z.number().int().min(1),
  roots: z.array(z.string().min(1)),
});

const wordDataSchema = z.object({
  version: z.string(),
  source: z.literal("quranhub-mcp"),
  generatedAt: z.string(),
  scope: z.object({ description: z.string(), surahIds: z.array(z.number().int()) }),
  words: z.record(z.string(), z.record(z.string(), z.array(wordTokenSchema))),
  roots: z.record(z.string(), z.record(z.string(), z.array(wordRootTokenSchema))),
});

export type WordToken = z.infer<typeof wordTokenSchema>;
export type WordRootToken = z.infer<typeof wordRootTokenSchema>;
export type WordDataBundle = z.infer<typeof wordDataSchema>;

function parseOrThrow<T>(label: string, schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new Error(`Bundle word-data tidak valid (${label}): ${first?.message ?? "unknown"}`);
  }
  return result.data;
}

export const WORD_DATA_FILE = "word-data-juz30.json";

// Checksum file tercatat di manifest.json (diisi pipeline); verifikasi byte-per-byte
// tidak dilakukan saat runtime — pola yang sama dengan loader bundle inti (loader.ts).
export const wordData = parseOrThrow("word-data-juz30", wordDataSchema, wordDataJson);

/** Token kata untuk satu ayat; undefined bila ayat/surah di luar scope bundle. */
export function getAyahWords(surahId: number, ayahNumber: number): WordToken[] | undefined {
  return wordData.words[String(surahId)]?.[String(ayahNumber)];
}

/** Akar kata (morfologi) untuk satu ayat; undefined bila tak ada di bundle. */
export function getAyahRoots(surahId: number, ayahNumber: number): WordRootToken[] | undefined {
  return wordData.roots[String(surahId)]?.[String(ayahNumber)];
}

/** Surah yang punya word-data lengkap. */
export function wordDataSurahIds(): number[] {
  return Object.keys(wordData.words)
    .map(Number)
    .sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Alignment T2/T3 (Langkah 3 ADR-005): teks tampilan SELALU dari bundle inti
// (equran.id — RULES § 7.1); dari word-data hanya diambil STRUKTUR (jumlah kata,
// batas token) dan LOCATION. Set marka harus sinkron dengan
// scripts/build-content/word-data.ts (normalizeArabic).
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-misleading-character-class -- class ini MEMANG kumpulan combining marks (harakat/marka Quran)
const QURAN_MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D5\u06D6-\u06ED\u08D3-\u08FF\u0640\uFEFF\u200B-\u200F]/g;

/** true bila token whitespace murni marka/dalalan (bukan kata, mis. " ە "). */
export function isMarkOnlyToken(token: string): boolean {
  return token.replaceAll(QURAN_MARKS, "").trim() === "";
}

export type AlignedWord = {
  /** Teks kata dari teks inti equran.id — satu-satunya sumber teks tampilan. */
  text: string;
  /** Lokasi quran.com "surah:ayah:word" bila segmentasi 1:1 sejajar; null bila tidak. */
  location: string | null;
};

/**
 * Kata-kata satu ayat siap-pakai untuk soal T2/T3: teks dari bundle inti, TANPA token
 * marka standalone; location terisi bila jumlah token quran.com sejajar (bukti Langkah 2:
 * 568/571 ayat sejajar; 3 ayat beda pemecahan → location null — fallback aman).
 */
export function alignAyahWords(surahId: number, ayahNumber: number, arabicText: string): AlignedWord[] {
  const words = arabicText.split(/\s+/).filter((w) => w !== "" && !isMarkOnlyToken(w));
  const tokens = getAyahWords(surahId, ayahNumber);
  if (tokens === undefined || tokens.length !== words.length) {
    return words.map((text) => ({ text, location: null }));
  }
  return words.map((text, i) => ({ text, location: tokens[i]?.location ?? null }));
}
