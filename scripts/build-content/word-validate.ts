/**
 * Owner: scripts/build-content. Validasi word-data sebelum emit (RULES § 7.2) —
 * gagal = pipeline berhenti tanpa emit. Scope: Al-Fatihah + Juz 30 (hasil probe
 * ADR-005 — glos Indonesia tidak tersedia, jadi scope disesuaikan).
 */
import { arabicSkeleton, extractWordTokens, joinTokens, normalizeArabic, type McpSurah, type WordRootToken, type WordToken } from "./word-data";

/** Al-Fatihah (jalur onboarding) + Juz 30 (surah 78–114 = default "mulai dari Juz 30"). */
export const WORD_DATA_SURAH_IDS: readonly number[] = [1, ...Array.from({ length: 37 }, (_, i) => 78 + i)];

export type WordDataIssue = { surahId: number; problem: string };

export type ValidatedWordData = {
  words: Record<string, Record<string, WordToken[]>>;
  roots: Record<string, Record<string, WordRootToken[]>>;
  issues: WordDataIssue[];
  /** Perbedaan jumlah token antar digitalisasi — artefak ortografi, bukan error. */
  warnings: string[];
};

/** Unit validasi yang bisa jalan tanpa MCP (unit test). */
export type SurahWordInput = {
  surahId: number;
  meta: { ayahCount: number } | undefined;
  /** Ayat inti dari bundle equran.id (acuan kebenaran, RULES § 7.1). */
  coreAyahs: Array<{ ayahNumber: number; arabic: string }>;
  surah: McpSurah | undefined;
};

export function validateSurahWords(input: SurahWordInput): {
  tokens: Record<string, WordToken[]>;
  issues: WordDataIssue[];
  warnings: string[];
} {
  const issues: WordDataIssue[] = [];
  const warnings: string[] = [];
  const tokens: Record<string, WordToken[]> = {};
  const { surahId, meta, coreAyahs, surah } = input;

  if (meta === undefined || surah === undefined) {
    issues.push({ surahId, problem: "surah tidak ditemukan di bundle inti / respons MCP" });
    return { tokens, issues, warnings };
  }
  if (surah.numberOfAyahs !== meta.ayahCount) {
    issues.push({ surahId, problem: `jumlah ayat MCP ${surah.numberOfAyahs} ≠ inti ${meta.ayahCount}` });
    return { tokens, issues, warnings };
  }

  for (const coreAyah of coreAyahs) {
    const mcpAyah = surah.ayahs.find((a) => a.numberInSurah === coreAyah.ayahNumber);
    if (mcpAyah === undefined) {
      issues.push({ surahId, problem: `ayat ${coreAyah.ayahNumber} tidak ada di respons MCP` });
      continue;
    }
    const ayahTokens = extractWordTokens(mcpAyah);
    if (ayahTokens.length === 0) {
      issues.push({ surahId, problem: `ayat ${coreAyah.ayahNumber} tidak punya token kata` });
      continue;
    }
    if (ayahTokens.some((t) => t.text.trim() === "")) {
      issues.push({ surahId, problem: `ayat ${coreAyah.ayahNumber} punya token kosong` });
      continue;
    }
    // Gate konten (wajib): konsonan ter-fold harus identik — bismillah prefix ayat 1
    // dan varian ejaan alef/ya/hamza antar digitalisasi disamakan lewat skeleton.
    // Teks asli kedua sumber tidak tersentuh (RULES § 7.1).
    const mcpJoined = arabicSkeleton(stripLeadingBismillah(joinTokens(ayahTokens)));
    const coreNormalized = arabicSkeleton(stripLeadingBismillah(coreAyah.arabic));
    if (mcpJoined !== coreNormalized) {
      issues.push({ surahId, problem: `ayat ${coreAyah.ayahNumber} teks MCP ≠ teks inti setelah normalisasi` });
      continue;
    }
    // Jumlah token mentah yang beda antar digitalisasi = warning (equran menjadikan
    // marka kecil seperti ە token sendiri; konsonan tetap teruji oleh gate di atas).
    const eqWordCount = coreAyah.arabic.split(/\s+/).filter(Boolean).length;
    if (eqWordCount !== ayahTokens.length) {
      warnings.push(`surah ${surahId} ayat ${coreAyah.ayahNumber}: token MCP ${ayahTokens.length} vs equran ${eqWordCount} (varian ortografi)`);
    }
    tokens[String(coreAyah.ayahNumber)] = ayahTokens;
  }
  return { tokens, issues, warnings };
}

const BISMILLAH_NORMALIZED = normalizeArabic("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ");

export function stripLeadingBismillah(text: string): string {
  const normalized = normalizeArabic(text);
  if (normalized.startsWith(BISMILLAH_NORMALIZED)) {
    return normalized.slice(BISMILLAH_NORMALIZED.length).trim();
  }
  return normalized;
}

/** Validasi penuh — dipakai pipeline live; morphology opsional per surah. */
export function validateWordData(
  inputs: SurahWordInput[],
  rootsBySurah: Record<number, Record<string, WordRootToken[]>>,
): ValidatedWordData {
  const words: Record<string, Record<string, WordToken[]>> = {};
  const roots: Record<string, Record<string, WordRootToken[]>> = {};
  const issues: WordDataIssue[] = [];
  const warnings: string[] = [];

  for (const input of inputs) {
    const { tokens, issues: surahIssues, warnings: surahWarnings } = validateSurahWords(input);
    issues.push(...surahIssues);
    warnings.push(...surahWarnings);
    if (surahIssues.length === 0 && Object.keys(tokens).length > 0) {
      words[String(input.surahId)] = tokens;
      const surahRoots = rootsBySurah[input.surahId];
      if (surahRoots !== undefined) {
        roots[String(input.surahId)] = surahRoots;
      }
    }
  }
  return { words, roots, issues, warnings };
}
