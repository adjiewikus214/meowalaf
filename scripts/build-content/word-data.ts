/**
 * Owner: scripts/build-content. Fetcher & parser word-data dari QuranHub MCP (ADR-005).
 * Hasil probe (2026-10-01): gateway TIDAK punya edisi glos per kata Indonesia; yang
 * tersedia & andal = segmentasi kata per ayat (edisi `quran-uthmani` + `words: true`,
 * 1 call/surah) dan morfologi Root per ayat (bahasa Arab). File ini hanya fetch+parse —
 * validasi di word-validate.ts, emit di emit-word-data.ts.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

import { McpClient } from "./mcp-client";

const CACHE_DIR = path.resolve(process.cwd(), ".content-cache");
const CACHE_VERSION = "v1";

export type McpWord = {
  text: string;
  char_type_name: string;
  position: number;
  verse_key: string;
  location: string;
};

export type McpAyah = {
  numberInSurah: number;
  juz: number;
  words?: McpWord[];
};

export type McpSurah = {
  number: number;
  numberOfAyahs: number;
  ayahs: McpAyah[];
};

export type McpMorphTag = {
  code: string;
  category: string;
  order: number;
  meaning?: string;
};

export type McpMorphAyah = Array<{
  word: { location: string; position: number };
  morphology: { tags_by_category?: Record<string, McpMorphTag[]> };
}>;

/** Token kata ter-normalisasi yang di-emit ke bundle. */
export type WordToken = {
  pos: number;
  text: string;
  /** Lokasi quran.com "surah:ayah:word" — kunci referensi morfologi/word-image nanti. */
  location: string;
};

export type WordRootToken = {
  pos: number;
  /** Kode akar (Root tags) dari morfologi MCP — dedupe, urut sesuai tag order. */
  roots: string[];
};

async function cachedJson<T>(label: string, produce: () => Promise<T>): Promise<T> {
  const cacheFile = path.join(CACHE_DIR, `${label}-${CACHE_VERSION}.json`);
  try {
    return JSON.parse(await fs.readFile(cacheFile, "utf8")) as T;
  } catch {
    // belum ada cache → fetch
  }
  const value = await produce();
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(cacheFile, JSON.stringify(value), "utf8");
  return value;
}

export type WordDataClient = {
  fetchSurahWords(surahId: number): Promise<McpSurah>;
  fetchAyahMorphology(surahId: number, ayahNumber: number): Promise<McpMorphAyah>;
};

export function createWordDataClient(client: McpClient): WordDataClient {
  return {
    async fetchSurahWords(surahId: number): Promise<McpSurah> {
      return cachedJson(`mcp-words-${surahId}`, async () => {
        const raw = await client.callToolByKey("getSurahByEdition", {
          surahNumber: surahId,
          editionIdentifier: "quran-uthmani",
          words: true,
        });
        return JSON.parse(raw) as McpSurah;
      });
    },
    async fetchAyahMorphology(surahId: number, ayahNumber: number): Promise<McpMorphAyah> {
      return cachedJson(`mcp-morph-${surahId}-${ayahNumber}`, async () => {
        const raw = await client.callToolByKey("getAyahMorphology", {
          reference: `${surahId}:${ayahNumber}`,
          include_meaning: true,
        });
        return JSON.parse(raw) as McpMorphAyah;
      });
    },
  };
}

/** Ambil kata valid (bukan angka ayat/end) dari satu ayah MCP. */
export function extractWordTokens(ayah: McpAyah): WordToken[] {
  const words = ayah.words ?? [];
  return words
    .filter((w) => w.char_type_name === "word")
    .map((w) => ({ pos: w.position, text: w.text, location: w.location }));
}

/** Ekstrak akar (kategori Root) dari respons morfologi, dikelompokkan per posisi kata. */
export function extractAyahRoots(morph: McpMorphAyah): WordRootToken[] {
  return morph
    .map((entry) => {
      const rootTags = [...(entry.morphology.tags_by_category?.["Root"] ?? [])].sort(
        (a, b) => a.order - b.order,
      );
      const roots = [...new Set(rootTags.map((t) => t.meaning).filter((m): m is string => Boolean(m)))];
      return { pos: entry.word.position, roots };
    })
    .sort((a, b) => a.pos - b.pos);
}

/**
 * Normalisasi teks Arab untuk cross-check: buang harakat, marka Quran, dalalan
 * (small heh U+06D5, tanda anotasi U+08D3–U+08FF), dan dagger-alef; samakan bentuk
 * alef (ٱ/أ/إ/آ → ا); buang tatweel/BOM. Hanya untuk perbandingan — teks asli
 * TIDAK pernah dimodifikasi (RULES § 7.1).
 */
const ALEF_UNIFY = new Map<string, string>([
  ["\u0622", "\u0627"],
  ["\u0623", "\u0627"],
  ["\u0625", "\u0627"],
  ["\u0671", "\u0627"],
]);

export function normalizeArabic(text: string): string {
  return text
    // eslint-disable-next-line no-misleading-character-class -- class ini MEMANG kumpulan combining marks (harakat/marka Quran) yang di-strip
    .replaceAll(/[\u0610-\u061A\u064B-\u065F\u0670\u06D5\u06D6-\u06ED\u08D3-\u08FF\u0640\uFEFF\u200B-\u200F]/g, "")
    .split("")
    .map((ch) => ALEF_UNIFY.get(ch) ?? ch)
    .join("")
    .replaceAll(/\s+/g, " ")
    .trim();
}

/**
 * Skeleton perbandingan dua digitalisasi Uthmani yang beda konvensi ejaan
 * (bukti dari cache, 2026-10-01): dagger-alef muncul sebagai alef penuh, alef
 * maksura, atau ya ("الصرط"/"الصراط"/"الذى"/"الذي"), dan hamza kecil sebagai
 * ء/أ/ئ/ؤ. Fold keluarga alef+ya+hamza → satu slot yang di-strip. HANYA untuk
 * perbandingan — teks asli kedua sumber tidak pernah tersentuh (RULES § 7.1).
 * Bukti: 571/571 ayat (Al-Fatihah + Juz 30) cocok setelah fold; tanpa fold ada
 * 126 variasi ejaan yang semuanya pola di atas.
 */
const ALEF_FAMILY = new Set([
  "\u0621", "\u0622", "\u0623", "\u0624", "\u0625", "\u0626", "\u0627", "\u0649", "\u064A", "\u0671",
]);

export function arabicSkeleton(text: string): string {
  return normalizeArabic(text)
    .split("")
    .filter((ch) => !ALEF_FAMILY.has(ch))
    .join("");
}

/** Gabungkan token kata jadi satu baris teks (untuk cross-check). */
export function joinTokens(tokens: readonly WordToken[]): string {
  return tokens.map((t) => t.text).join(" ");
}
