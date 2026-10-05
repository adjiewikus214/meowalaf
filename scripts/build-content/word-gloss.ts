/**
 * Owner: scripts/build-content. Deteksi & parser file glos per kata Indonesia dari
 * QUL (Tarteel) resource #96 "Indonesian wbw translation" (ADR-006). File diunduh
 * manual (butuh akun gratis) lalu ditaruh di .content-cache/ — modul ini HANYA
 * parse dari disk (tanpa jaringan): deteksi bentuk flat `surah:ayah:word`,
 * wrapper, atau array entri. Validasi di word-gloss-validate.ts, emit di
 * emit-word-gloss.ts.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

export const CACHE_DIR = path.resolve(process.cwd(), ".content-cache");

/** Lokasi quran.com "surah:ayah:word" — keying resmi QUL (dok halaman resource #96). */
export const LOCATION_KEY_RE = /^(\d{1,3}):(\d{1,3}):(\d{1,3})$/;

export type GlossShape = "flat" | "wrapper" | "array";

export type GlossFileCandidate = {
  file: string;
  shape: GlossShape;
  /** Nama properti sumber bila shape "wrapper". */
  from?: string;
  /** Peta lokasi → glos, sudah dinormalisasi (kunci di-trim, BOM dibuang). */
  glosses: Record<string, string>;
};

export type LicenseNote = { file: string; content: string };

/** Ambil teks glos dari nilai JSON (string langsung, atau objek ber-field teks). */
export function glossTextFromValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    const text = value.replace(/\uFEFF/g, "").trim();
    return text === "" ? undefined : text;
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const key of ["text", "translation", "gloss", "meaning"]) {
      const field = (value as Record<string, unknown>)[key];
      if (typeof field === "string" && field.replace(/\uFEFF/g, "").trim() !== "") {
        return field.replace(/\uFEFF/g, "").trim();
      }
    }
  }
  return undefined;
}

/** Rasio minimum kunci lokasi agar sebuah objek dianggap peta glos. */
const LOCATION_MATCH_RATIO = 0.5;

function parseRecordShape(value: unknown): Record<string, string> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return undefined;
  const locationEntries = entries.filter(([key]) => LOCATION_KEY_RE.test(key.trim()));
  if (locationEntries.length < entries.length * LOCATION_MATCH_RATIO) return undefined;
  const glosses: Record<string, string> = {};
  for (const [rawKey, rawValue] of locationEntries) {
    const text = glossTextFromValue(rawValue);
    if (text !== undefined) glosses[rawKey.trim()] = text;
  }
  return Object.keys(glosses).length > 0 ? glosses : undefined;
}

function entryLocation(row: Record<string, unknown>): string | undefined {
  if (typeof row.location === "string" && LOCATION_KEY_RE.test(row.location.trim())) {
    return row.location.trim();
  }
  const surah = row.surah_number ?? row.surahId ?? row.surah;
  const ayah = row.ayah_number ?? row.ayahNumber ?? row.ayah;
  const word = row.word_number ?? row.wordNumber ?? row.word ?? row.position;
  if (
    (typeof surah === "number" || typeof surah === "string") &&
    (typeof ayah === "number" || typeof ayah === "string") &&
    (typeof word === "number" || typeof word === "string")
  ) {
    const key = `${surah}:${ayah}:${word}`;
    if (LOCATION_KEY_RE.test(key)) return key;
  }
  return undefined;
}

function parseArrayShape(value: unknown): Record<string, string> | undefined {
  if (!Array.isArray(value)) return undefined;
  const glosses: Record<string, string> = {};
  let valid = 0;
  for (const entry of value) {
    if (entry === null || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const text = glossTextFromValue(row.text) ?? glossTextFromValue(row.translation);
    if (text === undefined) continue;
    const location = entryLocation(row);
    if (location === undefined) continue;
    valid += 1;
    glosses[location] = text;
  }
  if (valid === 0 || valid < value.length * LOCATION_MATCH_RATIO) return undefined;
  return glosses;
}

/** Kumpulkan kandidat peta glos dari satu raw JSON (coba flat → wrapper → array). */
export function collectGlossCandidates(file: string, raw: string): GlossFileCandidate[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const direct = parseRecordShape(parsed);
  if (direct) return [{ file, shape: "flat", glosses: direct }];
  if (Array.isArray(parsed)) {
    const arrayGlosses = parseArrayShape(parsed);
    return arrayGlosses ? [{ file, shape: "array", glosses: arrayGlosses }] : [];
  }
  if (parsed !== null && typeof parsed === "object") {
    const candidates: GlossFileCandidate[] = [];
    for (const [prop, value] of Object.entries(parsed as Record<string, unknown>)) {
      const recordGlosses = parseRecordShape(value);
      if (recordGlosses) {
        candidates.push({ file, shape: "wrapper", from: prop, glosses: recordGlosses });
        continue;
      }
      if (Array.isArray(value)) {
        const arrayGlosses = parseArrayShape(value);
        if (arrayGlosses) candidates.push({ file, shape: "wrapper", from: prop, glosses: arrayGlosses });
      }
    }
    return candidates;
  }
  return [];
}

/** Parse semua file & urutkan kandidat terbesar dulu (paling mungkin sumber QUL). */
export function findQulGlossCandidates(files: ReadonlyArray<{ file: string; raw: string }>): GlossFileCandidate[] {
  const candidates = files.flatMap(({ file, raw }) => collectGlossCandidates(file, raw));
  return candidates.sort((a, b) => Object.keys(b.glosses).length - Object.keys(a.glosses).length);
}

/** Prefiks file cache milik pipeline lain — bukan kandidat glos QUL. */
const SKIP_CACHE_PREFIXES = ["mcp-", "surah-", "word-gloss"];

/** Scan .content-cache untuk file JSON berbentuk peta glos QUL (nama bebas). */
export async function scanContentCache(dir: string = CACHE_DIR): Promise<GlossFileCandidate[]> {
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const files: Array<{ file: string; raw: string }> = [];
  for (const name of names.sort()) {
    if (!name.endsWith(".json")) continue;
    if (SKIP_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix))) continue;
    try {
      files.push({ file: name, raw: await fs.readFile(path.join(dir, name), "utf8") });
    } catch {
      // file hilang saat dibaca — lewati
    }
  }
  return findQulGlossCandidates(files);
}

/**
 * Langkah 1 ADR-006: cari catatan lisensi/kredit yang user taruh di .content-cache
 * (mis. `qul-license.md`). Tidak wajib — bila absen, atribusi default dipakai.
 */
export async function readLicenseNotes(dir: string = CACHE_DIR): Promise<LicenseNote[]> {
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const notes: LicenseNote[] = [];
  for (const name of names.sort()) {
    if (name.endsWith(".json")) continue;
    if (!/(licen|lisensi|credit|kredit|atribut|readme)/i.test(name)) continue;
    try {
      const content = (await fs.readFile(path.join(dir, name), "utf8")).trim();
      if (content !== "") notes.push({ file: name, content });
    } catch {
      // skip
    }
  }
  return notes;
}
