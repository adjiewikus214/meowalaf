/**
 * Validasi konten sebelum emit — GAGAL = pipeline gagal, tidak ada emit (RULES.md § 7).
 */
import { AYAH_COUNTS } from "./ayah-counts";
import type { SurahMetaRaw, TranslationRaw } from "./fetch";

export type UthmaniRaw = { surahId: number; texts: string[] };

export type ValidationIssue = { surahId: number; problem: string };

export type ValidatedSurah = {
  meta: SurahMetaRaw;
  arabic: string[];
  translation: string[];
};

export function validateSurah(
  meta: SurahMetaRaw | undefined,
  arabic: UthmaniRaw,
  translation: TranslationRaw,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const standard = AYAH_COUNTS[arabic.surahId - 1];

  if (meta === undefined) {
    issues.push({ surahId: arabic.surahId, problem: "metadata surah tidak ditemukan" });
    return issues;
  }
  if (standard === undefined) {
    issues.push({ surahId: arabic.surahId, problem: "jumlah ayat standar tidak ada di AYAH_COUNTS" });
    return issues;
  }
  if (arabic.texts.length !== standard) {
    issues.push({
      surahId: arabic.surahId,
      problem: `teks Arab: ${arabic.texts.length} ayat, standar ${standard}`,
    });
  }
  if (translation.texts.length !== standard) {
    issues.push({
      surahId: arabic.surahId,
      problem: `terjemahan: ${translation.texts.length} ayat, standar ${standard}`,
    });
  }
  arabic.texts.forEach((text, i) => {
    if (text.trim().length === 0) {
      issues.push({ surahId: arabic.surahId, problem: `teks Arab ayat ${i + 1} kosong` });
    }
  });
  translation.texts.forEach((text, i) => {
    if (text.trim().length === 0) {
      issues.push({ surahId: arabic.surahId, problem: `terjemahan ayat ${i + 1} kosong` });
    }
  });
  if (meta.ayahCount !== standard) {
    issues.push({
      surahId: arabic.surahId,
      problem: `metadata ayahCount ${meta.ayahCount} ≠ standar ${standard}`,
    });
  }
  return issues;
}

export function validateAll(
  metas: SurahMetaRaw[],
  arabic: UthmaniRaw[],
  translations: TranslationRaw[],
): { surahs: ValidatedSurah[]; issues: ValidationIssue[] } {
  const metaById = new Map(metas.map((m) => [m.id, m]));
  const translationById = new Map(translations.map((t) => [t.surahId, t]));
  const surahs: ValidatedSurah[] = [];
  const issues: ValidationIssue[] = [];

  for (const a of arabic) {
    const meta = metaById.get(a.surahId);
    const translation = translationById.get(a.surahId);
    if (translation === undefined) {
      issues.push({ surahId: a.surahId, problem: "terjemahan tidak ditemukan" });
      continue;
    }
    issues.push(...validateSurah(meta, a, translation));
    surahs.push({ meta: meta as SurahMetaRaw, arabic: a.texts, translation: translation.texts });
  }
  return { surahs, issues };
}
