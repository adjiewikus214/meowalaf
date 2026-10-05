import { describe, expect, it } from "vitest";

import {
  arabicSkeleton,
  extractAyahRoots,
  extractWordTokens,
  joinTokens,
  normalizeArabic,
  type McpAyah,
  type McpMorphAyah,
} from "./word-data";

describe("extractWordTokens", () => {
  it("buang token 'end' (angka ayat), posisi & lokasi dipertahankan", () => {
    const ayah: McpAyah = {
      numberInSurah: 1,
      juz: 30,
      words: [
        { text: "قُلْ", char_type_name: "word", position: 1, verse_key: "112:1", location: "112:1:1" },
        { text: "أَحَدٌ", char_type_name: "word", position: 4, verse_key: "112:1", location: "112:1:4" },
        { text: "١", char_type_name: "end", position: 5, verse_key: "112:1", location: "112:1:5" },
      ],
    };
    expect(extractWordTokens(ayah)).toEqual([
      { pos: 1, text: "قُلْ", location: "112:1:1" },
      { pos: 4, text: "أَحَدٌ", location: "112:1:4" },
    ]);
  });

  it("tanpa words → array kosong", () => {
    expect(extractWordTokens({ numberInSurah: 1, juz: 30 })).toEqual([]);
  });
});

describe("extractAyahRoots", () => {
  it("ambil kategori Root saja, dedupe, urut per posisi kata", () => {
    const morph: McpMorphAyah = [
      {
        word: { location: "1:1:2", position: 2 },
        morphology: {
          tags_by_category: {
            Root: [
              { code: "سمو", category: "Root", order: 2, meaning: "سمو" },
              { code: "خص", category: "Root", order: 15, meaning: "خص" },
            ],
            Irab: [{ code: "جر", category: "Irab", order: 7, meaning: "مجرور" }],
          },
        },
      },
      {
        word: { location: "1:1:1", position: 1 },
        morphology: { tags_by_category: { Root: [{ code: "سمو", category: "Root", order: 1, meaning: "سمو" }] } },
      },
    ];
    expect(extractAyahRoots(morph)).toEqual([
      { pos: 1, roots: ["سمو"] },
      { pos: 2, roots: ["سمو", "خص"] },
    ]);
  });

  it("tag Root tanpa meaning di-skip", () => {
    const morph: McpMorphAyah = [
      { word: { location: "1:1:1", position: 1 }, morphology: { tags_by_category: { Root: [{ code: "x", category: "Root", order: 1 }] } } },
    ];
    expect(extractAyahRoots(morph)).toEqual([{ pos: 1, roots: [] }]);
  });
});

describe("normalizeArabic", () => {
  it("buang harakat, marka Quran, samakan alef kecil", () => {
    expect(normalizeArabic("ٱللَّهِ")).toBe(normalizeArabic("الله"));
    expect(normalizeArabic("أَحَدٌ")).toBe(normalizeArabic("احد"));
    expect(normalizeArabic("بِسۡمِ")).toBe(normalizeArabic("بسم"));
  });

  it("rapatkan spasi", () => {
    expect(normalizeArabic("a  b \n c")).toBe("a b c");
  });
});

describe("arabicSkeleton", () => {
  it("alef hilang, konsonan & urutan tetap — cocokkan dagger-alef vs alef penuh", () => {
    expect(arabicSkeleton("الصرط")).toBe(arabicSkeleton("الصراط"));
    expect(arabicSkeleton("ٱللَّهِ")).toBe(arabicSkeleton("الله"));
    expect(arabicSkeleton("بِسۡمِ")).toBe("بسم");
  });

  it("beda konsonan tetap terdeteksi", () => {
    expect(arabicSkeleton("صرط")).not.toBe(arabicSkeleton("كرب"));
  });
});

describe("joinTokens", () => {
  it("gabung token dengan spasi", () => {
    expect(joinTokens([{ pos: 1, text: "قُلْ", location: "x" }, { pos: 2, text: "هُوَ", location: "y" }])).toBe("قُلْ هُوَ");
  });
});
