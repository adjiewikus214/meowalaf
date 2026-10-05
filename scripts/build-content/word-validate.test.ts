import { describe, expect, it } from "vitest";

import { getSurahAyahs } from "../../src/core/content/loader";
import type { McpSurah } from "./word-data";
import { stripLeadingBismillah, validateSurahWords, WORD_DATA_SURAH_IDS, type SurahWordInput } from "./word-validate";

// Ejaan MCP (dagger-alef) — untuk fixture beda konvensi alef dengan ejaan equran.
const MCP_STYLE_112_1 = "قُلْ هُوَ ٱللَّهُ أَحَدٌ";

function makeMcpSurah(ayahTokens: Record<number, string[]>, numberOfAyahs?: number): McpSurah {
  const ayahs = Object.entries(ayahTokens).map(([no, tokens]) => ({
    numberInSurah: Number(no),
    juz: 30,
    words: tokens.map((text, i) => ({
      text,
      char_type_name: "word",
      position: i + 1,
      verse_key: `112:${no}`,
      location: `112:${no}:${i + 1}`,
    })),
  }));
  return { number: 112, numberOfAyahs: numberOfAyahs ?? Object.keys(ayahTokens).length, ayahs };
}

const CORE_112 = getSurahAyahs(112).map((a) => ({ ayahNumber: a.ayahNumber, arabic: a.arabic }));
const META_112 = { ayahCount: 4 };

function baseInput(surah: McpSurah | undefined): SurahWordInput {
  return { surahId: 112, meta: META_112, coreAyahs: CORE_112, surah };
}

describe("validateSurahWords", () => {
  it("surah valid → token per ayat tersimpan, tanpa issue", () => {
    const surah = makeMcpSurah({
      1: CORE_112[0]!.arabic.split(" "),
      2: CORE_112[1]!.arabic.split(" "),
      3: CORE_112[2]!.arabic.split(" "),
      4: CORE_112[3]!.arabic.split(" "),
    });
    const { tokens, issues } = validateSurahWords(baseInput(surah));
    expect(issues).toEqual([]);
    expect(tokens["1"]).toHaveLength(4);
    expect(tokens["4"]).toBeDefined();
    expect(tokens["1"]?.map((t) => t.location)).toEqual(["112:1:1", "112:1:2", "112:1:3", "112:1:4"]);
  });

  it("jumlah ayat MCP ≠ inti → issue", () => {
    const surah = makeMcpSurah({ 1: ["س"] });
    const { tokens, issues } = validateSurahWords(baseInput(surah));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.problem).toContain("jumlah ayat");
    expect(tokens).toEqual({});
  });

  it("ayat hilang di MCP → issue", () => {
    const surah = makeMcpSurah({ 1: CORE_112[0]!.arabic.split(" "), 2: CORE_112[1]!.arabic.split(" "), 3: CORE_112[2]!.arabic.split(" ") }, 4);
    const { issues } = validateSurahWords(baseInput(surah));
    expect(issues.some((i) => i.problem.includes("tidak ada di respons MCP"))).toBe(true);
  });

  it("beda konvensi alef (dagger vs penuh) tetap LOLOS via skeleton", () => {
    // Ganti ejaan kata pertama inti ke gaya MCP (dagger-alef) — skeleton menyamakan.
    const mcpStyle = MCP_STYLE_112_1.split(" ");
    const surah = makeMcpSurah({ 1: mcpStyle, 2: CORE_112[1]!.arabic.split(" "), 3: CORE_112[2]!.arabic.split(" "), 4: CORE_112[3]!.arabic.split(" ") });
    const { tokens, issues } = validateSurahWords(baseInput(surah));
    expect(issues).toEqual([]);
    expect(tokens["1"]).toHaveLength(4);
  });

  it("varian ejaan ى/ي (dagger-alef) lolos lewat fold skeleton", () => {
    // Pola nyata dari cache: MCP "الذى" vs equran "الذي".
    const { issues } = validateSurahWords({
      surahId: 112,
      meta: { ayahCount: 1 },
      coreAyahs: [{ ayahNumber: 1, arabic: "الذي" }],
      surah: makeMcpSurah({ 1: ["الذى"] }),
    });
    expect(issues).toEqual([]);
  });

  it("beda jumlah token (marka standalone equran) → warning, bukan gagal", () => {
    // Pola nyata (94 ayat): equran menjadikan marka kecil ( ە ) token sendiri;
    // gate konten tetap lolos karena marka ter-strip saat perbandingan.
    const coreAyahs = [{ ayahNumber: 1, arabic: "قُلْ هُوَ ٱللَّهُ أَحَدٌ ە" }];
    const surah = makeMcpSurah({ 1: ["قُلْ", "هُوَ", "ٱللَّهُ", "أَحَدٌ"] }, 1);
    const { issues, warnings } = validateSurahWords({ surahId: 112, meta: { ayahCount: 1 }, coreAyahs, surah });
    expect(issues).toEqual([]);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("token MCP 4 vs equran 5");
  });

  it("teks MCP ≠ inti (kata salah) → issue, ayat tidak di-emit", () => {
    const wrong = CORE_112[0]!.arabic.split(" ");
    wrong[1] = "كذا";
    const surah = makeMcpSurah({ 1: wrong, 2: CORE_112[1]!.arabic.split(" "), 3: CORE_112[2]!.arabic.split(" "), 4: CORE_112[3]!.arabic.split(" ") });
    const { tokens, issues } = validateSurahWords(baseInput(surah));
    expect(issues.some((i) => i.problem.includes("teks MCP ≠ teks inti"))).toBe(true);
    expect(tokens["1"]).toBeUndefined();
  });

  it("surah tidak dikenal → issue", () => {
    const { issues } = validateSurahWords({ surahId: 999, meta: undefined, coreAyahs: [], surah: undefined });
    expect(issues).toHaveLength(1);
  });

  it("WORD_DATA_SURAH_IDS = Al-Fatihah + 78–114 (37 surah)", () => {
    expect(WORD_DATA_SURAH_IDS).toHaveLength(38);
    expect(WORD_DATA_SURAH_IDS[0]).toBe(1);
    expect(WORD_DATA_SURAH_IDS.at(-1)).toBe(114);
  });
});

describe("stripLeadingBismillah", () => {
  it("buang bismillah prefix — hasilnya teks ternormalisasi", () => {
    const withBismillah = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ قُلْ هُوَ أَحَدٌ";
    const stripped = stripLeadingBismillah(withBismillah);
    expect(stripped).not.toContain("بسم");
    expect(stripped).toContain("قل هو");
    expect(stripLeadingBismillah("قُلْ هُوَ")).toBe("قل هو");
  });
});
