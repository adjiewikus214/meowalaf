/**
 * Owner: features/lessons. Pemecahan surah menjadi unit lesson 3–7 ayat (PRD § 5.4).
 * Pure — boleh di-import generator, hooks, dan app/; hanya bergantung core/content.
 */
import { getSurahMeta } from "@/core/content/meta";

export const MAX_AYAHS_PER_UNIT = 7;
export const MIN_AYAHS_PER_UNIT = 3;

export type LessonUnit = {
  /** 0-based. */
  unitIndex: number;
  unitCount: number;
  /** 1-based, inklusif. */
  startAyah: number;
  /** 1-based, inklusif. */
  endAyah: number;
  ayahCount: number;
};

/**
 * Jumlah unit = ceil(ayahCount / 7) → tiap unit ≤ 7 ayat; karena semua surah ≥ 3 ayat
 * (skema loader) dan pembagiannya merata, tiap unit otomatis ≥ 3 ayat.
 */
export function getUnitCount(surahId: number): number | undefined {
  const meta = getSurahMeta(surahId);
  if (meta === undefined) return undefined;
  return Math.ceil(meta.ayahCount / MAX_AYAHS_PER_UNIT);
}

/** Unit lesson ke-`unitIndex` (0-based), atau undefined bila surah/unit tak ada. */
export function getLessonUnit(surahId: number, unitIndex: number): LessonUnit | undefined {
  const meta = getSurahMeta(surahId);
  const unitCount = getUnitCount(surahId);
  if (meta === undefined || unitCount === undefined || unitIndex < 0 || unitIndex >= unitCount) {
    return undefined;
  }
  // Pembagian merata: `extra` unit pertama dapat base+1 ayat, sisanya base.
  const base = Math.floor(meta.ayahCount / unitCount);
  const extra = meta.ayahCount % unitCount;
  const startAyah = unitIndex * base + Math.min(unitIndex, extra) + 1;
  const size = base + (unitIndex < extra ? 1 : 0);
  return {
    unitIndex,
    unitCount,
    startAyah,
    endAyah: startAyah + size - 1,
    ayahCount: size,
  };
}

/**
 * Unit berikutnya dalam surah yang sama — undefined di unit terakhir
 * (dipakai tombol "Lanjut" di layar hasil: chain lesson di surah yang sama).
 */
export function getNextUnitIndex(surahId: number, unitIndex: number): number | undefined {
  const unitCount = getUnitCount(surahId);
  if (unitCount === undefined || unitIndex < 0) return undefined;
  const next = unitIndex + 1;
  return next < unitCount ? next : undefined;
}
