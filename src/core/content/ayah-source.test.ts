/**
 * Test core/content/ayah-source — registry sumber ayat.
 *
 * Ini yang menjaga generator soal tetap murni tanpa menarik modul teks 2,6 MB ke
 * bundle startup: kalau registry ini diam-diam mengembalikan array kosong, lesson
 * bisa jadi tidak punya soal tanpa error apa pun. Jadi kasus "belum terdaftar"
 * diuji eksplisit.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { isAyahSourceReady, registerAyahSource, resetAyahSourceForTest, surahAyahs } from "./ayah-source";
import { getSurahAyahs } from "./loader";

describe("registry sumber ayat", () => {
  beforeEach(() => {
    resetAyahSourceForTest();
  });

  it("belum terdaftar -> tidak siap dan ayat kosong (bukan error diam-diam)", () => {
    expect(isAyahSourceReady()).toBe(false);
    expect(surahAyahs(1)).toEqual([]);
  });

  it("modul loader mendaftarkan dirinya saat diimpor", () => {
    registerAyahSource(getSurahAyahs);
    expect(isAyahSourceReady()).toBe(true);
    expect(surahAyahs(1)).toHaveLength(7);
  });

  it("hasil adalah salinan: layar tidak bisa merusak sumber", () => {
    registerAyahSource(getSurahAyahs);
    const first = surahAyahs(1);
    first.length = 0;
    expect(surahAyahs(1)).toHaveLength(7);
  });

  it("surah di luar rentang -> kosong, bukan error", () => {
    registerAyahSource(getSurahAyahs);
    expect(surahAyahs(0)).toEqual([]);
    expect(surahAyahs(115)).toEqual([]);
  });
});