import { describe, expect, it } from "vitest";

import { getSurahAyahs } from "./loader";
import { alignAyahWords, isMarkOnlyToken, wordDataSurahIds } from "./word-data";

describe("isMarkOnlyToken", () => {
  it("token marka standalone terdeteksi", () => {
    expect(isMarkOnlyToken(" ە ")).toBe(true);
    expect(isMarkOnlyToken("ۖ")).toBe(true);
  });

  it("kata asli bukan marka", () => {
    expect(isMarkOnlyToken("قُلْ")).toBe(false);
    expect(isMarkOnlyToken("ٱللَّهُ")).toBe(false);
    expect(isMarkOnlyToken("")).toBe(true);
  });
});

describe("wordDataSurahIds", () => {
  it("scope = Al-Fatihah + Juz 30 (38 surah)", () => {
    const ids = wordDataSurahIds();
    expect(ids).toHaveLength(38);
    expect(ids[0]).toBe(1);
    expect(ids.at(-1)).toBe(114);
  });
});

describe("alignAyahWords", () => {
  const equran1 = getSurahAyahs(1);

  it("Al-Fatihah 1:1 — teks equran.id + location 1:1:n (segmentasi sejajar)", () => {
    const aligned = alignAyahWords(1, 1, equran1[0]?.arabic ?? "");
    expect(aligned).toHaveLength(4);
    expect(aligned[0]?.text).toBe(equran1[0]?.arabic.split(/\s+/)[0]);
    expect(aligned.map((w) => w.location)).toEqual(["1:1:1", "1:1:2", "1:1:3", "1:1:4"]);
  });

  it("1:7 — token marka standalone equran dibuang, location tetap terisi", () => {
    const raw = equran1[6]?.arabic ?? "";
    const aligned = alignAyahWords(1, 7, raw);
    // Semua token aligned adalah kata sungguhan (bukan marka).
    expect(aligned.every((w) => !isMarkOnlyToken(w.text))).toBe(true);
    expect(aligned.at(-1)?.location).toBe("1:7:9");
    // Gabungan kata ≠ teks mentah bila ada marka (marka tak termasuk).
    const withoutMarks = aligned.map((w) => w.text).join(" ");
    expect(withoutMarks.split(/\s+/)).toHaveLength(9);
  });

  it("ayat beda pemecahan (84:21) → location null, teks equran tetap dipakai", () => {
    const equran84 = getSurahAyahs(84);
    const ayah21 = equran84.find((a) => a.ayahNumber === 21);
    if (ayah21 === undefined) throw new Error("84:21 tidak ada di bundle inti");
    const aligned = alignAyahWords(84, 21, ayah21.arabic);
    expect(aligned.every((w) => w.location === null)).toBe(true);
    expect(aligned.length).toBeGreaterThan(0);
  });

  it("surah luar scope (Al-Baqarah) → location null", () => {
    const equran2 = getSurahAyahs(2);
    const aligned = alignAyahWords(2, 1, equran2[0]?.arabic ?? "");
    expect(aligned.every((w) => w.location === null)).toBe(true);
    expect(aligned.length).toBeGreaterThan(0);
  });
});
