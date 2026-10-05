/**
 * Owner: scripts/build-content. Validator glos per kata sebelum emit (3 langkah
 * wajib ADR-006): (1) lisensi/kredit dicatat, (2) struktur JSON QUL cocok dengan
 * token word-data pada 3 ayat sampel (1:1, 112:1, 84:21), (3) count-check seluruh
 * scope 571 ayat + sampling review manusia (RULES § 7.7 — dilaporkan, bukan gate
 * otomatis). Gagal = pipeline berhenti tanpa emit; token tanpa glos = skip aman
 * di runtime (quest fallback), bukan gagal pipeline.
 */
import type { WordToken } from "./word-data";
import { WORD_DATA_SURAH_IDS } from "./word-validate";

/** Keying resmi QUL mengikuti location quran.com — sama dengan token word-data. */
export const GLOSS_SURAH_IDS: readonly number[] = WORD_DATA_SURAH_IDS;

/** Langkah 2 ADR-006: ayat sampel struktur. */
export const SAMPLE_AYAHS: ReadonlyArray<{ surahId: number; ayahNumber: number }> = [
  { surahId: 1, ayahNumber: 1 },
  { surahId: 112, ayahNumber: 1 },
  { surahId: 84, ayahNumber: 21 },
];

export type GlossIssue = { problem: string };
export type GlossWarning = { scope: string; detail: string };

export type GlossSampleReport = {
  surahId: number;
  ayahNumber: number;
  tokenCount: number;
  matched: number;
  missing: string[];
};

export type ValidatedGlossData = {
  /** surahId → ayahNumber → { pos, gloss } — hanya ayat yang ter-cover ≥95% token. */
  glosses: Record<string, Record<string, Array<{ pos: number; gloss: string }>>>;
  issues: GlossIssue[];
  warnings: GlossWarning[];
  samples: GlossSampleReport[];
  coverage: { ayahs: number; ayahsFullyCovered: number; tokens: number; tokensWithGloss: number };
};

export type GlossWordDataSource = {
  /** Token per ayat dari word-data-juz30.json (sudah tervalidasi pipeline ADR-005). */
  tokensBySurah: Record<string, Record<string, WordToken[]>>;
};

export type GlossSourceInput = {
  /** Peta lokasi "surah:ayah:word" → glos dari file QUL (hasil parser word-gloss.ts). */
  glosses: Record<string, string>;
  /** Catatan lisensi/kredit (Langkah 1 ADR-006) — kosong berarti pakai atribusi default. */
  licenseNotes: ReadonlyArray<{ file: string; content: string }>;
  /**File sumber glos (untuk pelacakan emit). */
  sourceFile?: string;
};

const COVER_RATIO = 0.95;

/**
 * Langkah 2+3: cocokkan peta glos QUL terhadap token word-data. Kunci join =
 * `location` quran.com — sama-sama digitalisasi quran.com, jadi identik bila file
 * sesuai dokumentasi QUL.
 */
export function validateGlossData(
  source: GlossSourceInput,
  words: GlossWordDataSource,
  surahIds: readonly number[] = GLOSS_SURAH_IDS,
): ValidatedGlossData {
  const issues: GlossIssue[] = [];
  const warnings: GlossWarning[] = [];
  const samples: GlossSampleReport[] = [];
  const glosses: Record<string, Record<string, Array<{ pos: number; gloss: string }>>> = {};

  if (Object.keys(source.glosses).length === 0) {
    issues.push({ problem: "peta glos kosong — file QUL tidak berisi kunci 'surah:ayah:word'" });
    return { glosses, issues, warnings, samples, coverage: { ayahs: 0, ayahsFullyCovered: 0, tokens: 0, tokensWithGloss: 0 } };
  }

  let totalTokens = 0;
  let tokensWithGloss = 0;
  let totalAyahs = 0;
  let fullyCovered = 0;

  for (const surahId of surahIds) {
    const ayahTokens = words.tokensBySurah[String(surahId)];
    if (ayahTokens === undefined) {
      issues.push({ problem: `surah ${surahId} tidak ada di word-data (scope word-gloss harus = word-data)` });
      continue;
    }
    const byAyah: Record<string, Array<{ pos: number; gloss: string }>> = {};
    for (const [ayahNumber, tokens] of Object.entries(ayahTokens)) {
      totalAyahs += 1;
      const entries: Array<{ pos: number; gloss: string }> = [];
      const missing: string[] = [];
      for (const token of tokens) {
        totalTokens += 1;
        const gloss = source.glosses[token.location];
        if (gloss === undefined) {
          missing.push(token.location);
          continue;
        }
        tokensWithGloss += 1;
        entries.push({ pos: token.pos, gloss });
      }
      // Langkah 2: ayat sampel dilaporkan apa adanya (matched/missing) — issue bila
      // sama sekali tidak ada glos, karena itu tanda keying salah total.
      const isSample = SAMPLE_AYAHS.some((s) => s.surahId === surahId && s.ayahNumber === Number(ayahNumber));
      if (isSample) {
        samples.push({
          surahId,
          ayahNumber: Number(ayahNumber),
          tokenCount: tokens.length,
          matched: entries.length,
          missing,
        });
        if (entries.length === 0) {
          issues.push({ problem: `sampel ${surahId}:${ayahNumber} tidak punya glos sama sekali — keying QUL salah bentuk` });
        }
      }
      // Ayat sampel tetap dilaporkan terpisah (matched/missing) untuk review, tapi
      // ambang emit seragam: ayat dengan <95% token berglos tidak di-emit.
      const covered = entries.length / Math.max(tokens.length, 1);
      if (covered >= COVER_RATIO) {
        byAyah[ayahNumber] = entries;
        if (missing.length === 0) fullyCovered += 1;
      } else {
        warnings.push({
          scope: `${surahId}:${ayahNumber}`,
          detail: `hanya ${entries.length}/${tokens.length} token berglos — ayat tidak di-emit`,
        });
      }
    }
    if (Object.keys(byAyah).length > 0) glosses[String(surahId)] = byAyah;
  }

  // Count-check Langkah 3: seluruh ayat scope harus muncul di emit atau warning.
  const emittedAyahs = Object.values(glosses).reduce((n, ayahs) => n + Object.keys(ayahs).length, 0);
  if (emittedAyahs !== totalAyahs) {
    warnings.push({
      scope: "coverage",
      detail: `${emittedAyahs}/${totalAyahs} ayat di-emit (sisanya di bawah ambang ${Math.round(COVER_RATIO * 100)}%)`,
    });
  }

  if (source.licenseNotes.length === 0) {
    warnings.push({
      scope: "license",
      detail: "catatan lisensi/kredit QUL belum ditaruh di .content-cache — atribusi default dipakai (Lisensi QUL per-resource)",
    });
  }

  return {
    glosses,
    issues,
    warnings,
    samples,
    coverage: { ayahs: totalAyahs, ayahsFullyCovered: fullyCovered, tokens: totalTokens, tokensWithGloss },
  };
}
