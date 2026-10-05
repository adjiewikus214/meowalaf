import { describe, expect, it } from "vitest";

import { validateAll, validateSurah } from "./validate";
import type { SurahMetaRaw, TranslationRaw } from "./fetch";
import type { UthmaniRaw } from "./validate";

const meta: SurahMetaRaw = {
  id: 1,
  nameArabic: "الفاتحة",
  nameLatin: "Al-Fatihah",
  meaningId: "Pembukaan",
  ayahCount: 7,
  revelation: "mekkah",
};

const arabic7: UthmaniRaw = { surahId: 1, texts: Array.from({ length: 7 }, (_, i) => `نص ${i + 1}`) };
const trans7: TranslationRaw = { surahId: 1, texts: Array.from({ length: 7 }, (_, i) => `teks ${i + 1}`) };

describe("validateSurah", () => {
  it("data lengkap 7 ayat → tanpa masalah", () => {
    expect(validateSurah(meta, arabic7, trans7)).toHaveLength(0);
  });

  it("teks Arab kurang → gagal", () => {
    const issues = validateSurah(meta, { surahId: 1, texts: arabic7.texts.slice(0, 6) }, trans7);
    expect(issues.some((i) => i.problem.includes("teks Arab"))).toBe(true);
  });

  it("terjemahan kosong di satu ayat → gagal", () => {
    const broken = { surahId: 1, texts: [...trans7.texts.slice(0, 6), "  "] };
    const issues = validateSurah(meta, arabic7, broken);
    expect(issues.some((i) => i.problem.includes("ayat 7 kosong"))).toBe(true);
  });

  it("metadata ayahCount ≠ standar → gagal", () => {
    const issues = validateSurah({ ...meta, ayahCount: 6 }, arabic7, trans7);
    expect(issues.some((i) => i.problem.includes("≠ standar"))).toBe(true);
  });
});

describe("validateAll", () => {
  it("gagal bila terjemahan surah tidak ada", () => {
    const { issues } = validateAll([meta], [arabic7], []);
    expect(issues[0]?.problem).toContain("terjemahan tidak ditemukan");
  });
});
