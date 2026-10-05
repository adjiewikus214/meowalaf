/**
 * Fetch konten dari equran.id (Kemenag open data) dengan cache lokal di
 * .content-cache/ agar re-run pipeline tidak selalu memukul API (ARCHITECTURE.md § 6).
 */
import { promises as fs } from "node:fs";
import path from "node:path";

import { AYAH_COUNTS } from "./ayah-counts";
import { EQURAN } from "./sources";

export type SurahMetaRaw = {
  id: number;
  nameArabic: string;
  nameLatin: string;
  meaningId: string;
  ayahCount: number;
  revelation: "mekkah" | "madinah";
};

export type TranslationRaw = {
  surahId: number;
  /** Terjemahan per ayat, index 0 = ayat 1 */
  texts: string[];
};

const CACHE_DIR = path.resolve(process.cwd(), ".content-cache");
const CACHE_VERSION = "v1";

type EquranAyah = { nomorAyat: number; teksArab: string; teksIndonesia: string };
type EquranSurah = {
  nomor: number;
  nama: string;
  namaLatin: string;
  jumlahAyat: number;
  tempatTurun: string;
  arti: string;
  ayat: EquranAyah[];
};

async function cachedFetchJson<T>(label: string, url: string, parse: (raw: unknown) => T): Promise<T> {
  const cacheFile = path.join(CACHE_DIR, `${label}-${CACHE_VERSION}.json`);
  try {
    const cached = await fs.readFile(cacheFile, "utf8");
    return parse(JSON.parse(cached));
  } catch {
    // belum ada cache -> fetch jaringan
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Fetch gagal ${res.status} untuk ${url}`);
  }
  const json: unknown = await res.json();
  const parsed = parse(json);
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(cacheFile, JSON.stringify(parsed), "utf8");
  return parsed;
}

function parseSurah(raw: unknown): EquranSurah {
  const root = raw as { data?: unknown };
  const data = root.data as EquranSurah | undefined;
  if (data === undefined || !Array.isArray(data.ayat)) {
    throw new Error("Format equran.id tidak dikenal");
  }
  return data;
}

function parseSurahList(raw: unknown): SurahMetaRaw[] {
  const root = raw as { data?: unknown };
  if (!Array.isArray(root.data)) {
    throw new Error("Format list equran.id tidak dikenal");
  }
  return (root.data as Record<string, unknown>[]).map((d) => {
    const id = Number(d["nomor"]);
    if (!Number.isInteger(id) || id < 1 || id > 114) {
      throw new Error(`nomor surah tidak valid: ${String(d["nomor"])}`);
    }
    return {
      id,
      nameArabic: String(d["nama"] ?? ""),
      nameLatin: String(d["namaLatin"] ?? ""),
      meaningId: String(d["arti"] ?? ""),
      ayahCount: AYAH_COUNTS[id - 1] ?? 0,
      revelation: String(d["tempatTurun"] ?? "").toLowerCase() === "madinah" ? "madinah" : "mekkah",
    } satisfies SurahMetaRaw;
  });
}

export function fetchSurahMetadata(): Promise<SurahMetaRaw[]> {
  return cachedFetchJson("surah-list", EQURAN.list, parseSurahList);
}

export async function fetchSurahFull(surahId: number): Promise<{
  meta: SurahMetaRaw;
  arabic: string[];
  translation: string[];
}> {
  const s = await cachedFetchJson(`surah-${surahId}`, EQURAN.detail(surahId), parseSurah);
  return {
    meta: {
      id: s.nomor,
      nameArabic: s.nama,
      nameLatin: s.namaLatin,
      meaningId: s.arti,
      ayahCount: s.jumlahAyat,
      revelation: s.tempatTurun.toLowerCase() === "madinah" ? "madinah" : "mekkah",
    },
    arabic: s.ayat.map((a) => a.teksArab),
    translation: s.ayat.map((a) => a.teksIndonesia),
  };
}
