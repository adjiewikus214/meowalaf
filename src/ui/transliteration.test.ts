import { describe, expect, it } from "vitest";

import { needsTransliterationFont, transliterationTokens } from "./transliteration";

/**
 * Aturan fallback transliterasi (lihat `transliteration.ts`): Poppins tidak punya
 * Ḥ ṣ Ṭ ẓ / macron / ʻ, dan terjemahan ayat memakainya. Yang dijaga di sini:
 *   1. karakter **yang** dianggap butuh fallback tidak lebih dari yang perlu
 *      (kalau melebar, kata biasa ikut dipindah ke font lain);
 *   2. teks **tidak pernah berubah** di jalan — ini teks mushaf/terjemahan, dan
 *      tokenisasi yang salah berarti ayat berubah di layar.
 */
describe("fallback font transliterasi", () => {
  it("mengenali karakter yang benar-benar hilang dari Poppins", () => {
    // 12 glyph yang dipakai terjemahan ayat di repo ini
    for (const char of ["Ḥ", "ḥ", "ṡ", "Ṣ", "ṣ", "Ṭ", "ṭ", "ẓ", "ʻ", "̄", "̓", "ḣ"]) {
      expect(needsTransliterationFont(char), `harus butuh fallback: ${char}`).toBe(true);
    }
  });

  it("tidak menyalakan fallback untuk teks biasa", () => {
    for (const text of [
      "Segala puji bagi Allah",
      "al-ākhira", // ā ADA di Poppins
      "al-Akhirah",
      "بِسْمِ اللّٰهِ", // Arab = font lain
      "🔥 5 ayat 🔥",
      "",
    ]) {
      expect(needsTransliterationFont(text), `tidak perlu fallback: ${text}`).toBe(false);
    }
  });

  it("tokenisasi tidak mengubah teks sama sekali", () => {
    const samples = [
      "Doa mereka di dalamnya adalah “Subḥānallāhumma” (Maha Suci Engkau, ya Tuhan kami).",
      "Kepada penduduk Madyan, Kami (utus) saudara mereka, Syuʻbaib.",
      "Salat Wusṭā.",
      "  spasi  ganda  ",
      "tanpa spasi",
      "",
    ];
    for (const sample of samples) {
      expect(transliterationTokens(sample).map((token) => token.text).join("")).toBe(sample);
    }
  });

  it("hanya menandai kata yang benar-benar perlu fallback", () => {
    const tokens = transliterationTokens("Doa mereka “Subḥānallāhumma” ya.");
    const flagged = tokens.filter((token) => token.fallback).map((token) => token.text);
    expect(flagged).toEqual(["“Subḥānallāhumma”"]);
    // Spasi tidak pernah ditandai fallback (kalau iya, setiap spasi jadi node).
    expect(tokens.some((token) => token.fallback && token.text.trim() === "")).toBe(false);
  });

  it("menandai dua kata terpisah di teks yang sama", () => {
    const tokens = transliterationTokens("Syuʻbaib berkata kepada ʻArasy");
    expect(tokens.filter((token) => token.fallback).map((token) => token.text)).toEqual(["Syuʻbaib", "ʻArasy"]);
  });
});