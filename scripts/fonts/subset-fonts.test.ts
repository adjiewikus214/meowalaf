/**
 * Regression guard untuk subset font (docs/PERF.md).
 *
 * Kalau isi repo berubah - label baru, terjemahan baru, `content:build` ulang -
 * dan subset belum dibangun ulang, test ini harus gagal. Tanpa itu, subset diam
 * diam jadi lebih tua dari teks yang harus ia render.
 *
 * Kalau test gagal, jalankan `npm run fonts:subset`. Jangan menambah karakter
 * ke allow-list di bawah sebelum tahu kenapa font sistem yang menanganinya.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { readCmapCodepoints } from "./cmap.mjs";
import { FONT_PLAN, PROJECT_ROOT, collectGlyphs, isArabicCodePoint } from "./glyphs.mjs";

const FONT_DIR = path.join(PROJECT_ROOT, "src", "ui", "assets", "fonts");

const hex = (cp: number) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
const hexList = (cps: number[], limit = 12) => {
  const shown = cps.slice(0, limit).map(hex).join(", ");
  return cps.length > limit ? `${shown}, ... (+${cps.length - limit})` : shown;
};

/**
 * Karakter yang dipakai teks app tapi tidak ada di satu pun font yang dibundel,
 * jadi dirender font sistem: 24 emoji, 11 simbol, dan U+08D6 (harakat Arab yang
 * tidak dimiliki Amiri).
 *
 * U+2192 / U+2194 (panah) dan U+26A0 (tanda peringatan) masuk daftar karena
 * **hanya muncul di komentar dan nama test** — tidak pernah sampai layar.
 * Inventaris memang sengaja menghitung
 * komentar (pernah kejadian saat rebranding), jadi mereka tetap tercatat di sini
 * sebagai keputusan sadar, bukan render yang terlihat user.
 *
 * Semuanya begitu juga sebelum subset, jadi ini bukan regresi. Tapi kalau
 * daftarnya bertambah atau berkurang, ada teks yang mengambil font sistem tanpa
 * kita sadari - itu perlu keputusan sadar, bukan konsekuensi diam-diam.
 */
// U+1F4D1 (memo) masuk karena copy empty-state "Ayat Favorit" memakainya; emoji
// di sini sengaja — itu gaya meta-experience, bukan di sebelah teks ayat.
// U+1F4FF (tali tasbih/rosario) dipakai emoji achievement "Dhikr Starter" —
// ikon achievement, bukan teks dzikirnya.
const SYSTEM_FONT_CHARACTERS = [
  0x08d6, 0x2192, 0x2194, 0x23f8, 0x25a2, 0x26a0, 0x26a1, 0x2713, 0x2715, 0x2728, 0x279c, 0x2b50, 0xfe0f, 0x1f30c, 0x1f319,
  0x1f331, 0x1f389, 0x1f3a7, 0x1f3c6, 0x1f423, 0x1f442, 0x1f4aa, 0x1f4c8, 0x1f4d1, 0x1f4d6, 0x1f4e1, 0x1f4ff, 0x1f507,
  0x1f50a, 0x1f50d, 0x1f512, 0x1f525, 0x1f54a, 0x1f54c, 0x1f5fa, 0x1f639, 0x1f914, 0x1f932, 0x1f9d0,
];

const subsets = new Map(
  FONT_PLAN.map((plan) => [
    plan.file,
    new Set(readCmapCodepoints(fs.readFileSync(path.join(FONT_DIR, plan.file)))),
  ]),
);
const sources = new Map(
  FONT_PLAN.map((plan) => [plan.file, fs.readFileSync(path.join(FONT_DIR, "_source", plan.file))]),
);
const { ui, arabic, fromContent } = collectGlyphs();

describe("subset font", () => {
  it("setiap font yang dirender punya file hasil dan file asli", () => {
    expect([...subsets.keys()]).toEqual(FONT_PLAN.map((plan) => plan.file));
    for (const plan of FONT_PLAN) {
      expect(fs.existsSync(path.join(FONT_DIR, "_source", plan.file))).toBe(true);
    }
  });

  it("hasil subset selalu lebih kecil dari font asli", () => {
    for (const plan of FONT_PLAN) {
      const subset = fs.statSync(path.join(FONT_DIR, plan.file)).size;
      const source = sources.get(plan.file)!.length;
      expect(subset, `${plan.file} tidak terpangkas`).toBeLessThan(source);
    }
  });

  it("font Latin menutupi semua teks non-Arab yang ada di font asli", () => {
    const wanted = ui.filter((cp) => !isArabicCodePoint(cp));
    for (const plan of FONT_PLAN.filter((p) => p.set === "ui")) {
      const covered = subsets.get(plan.file)!;
      // Yang wajib covered hanya karakter yang memang ada di font asli. Sisanya
      // sudah jatuh ke font sistem sejak sebelum subset.
      const sourceCmap = new Set(readCmapCodepoints(sources.get(plan.file)!));
      const lost = wanted.filter((cp) => sourceCmap.has(cp) && !covered.has(cp));
      expect(lost, `${plan.file} kehilangan glyph: ${hexList(lost)}`).toEqual([]);
    }
  });

  it("Amiri menutupi seluruh teks mushaf", () => {
    const covered = subsets.get("Amiri-Regular.ttf")!;
    // Syaratnya dua: tidak ada glyph yang hilang dibanding font asli, dan semua
    // karakter mushaf yang benar-benar muncul di repo tetap ter-cover.
    const sourceCmap = new Set(readCmapCodepoints(sources.get("Amiri-Regular.ttf")!));
    const lost = arabic.filter((cp) => sourceCmap.has(cp) && !covered.has(cp));
    expect(lost, `Amiri kehilangan glyph: ${hexList(lost)}`).toEqual([]);

    // U+08D6 (small high meem isolated form) memang tidak ada di Amiri dan sudah
    // jatuh ke font Arab sistem sebelum subset juga. Selain itu tidak boleh ada
    // karakter mushaf yang tidak bisa dirender Amiri.
    const lostHard = fromContent.arabic.filter((cp) => !covered.has(cp) && cp !== 0x08d6);
    expect(lostHard, `Amiri kehilangan glyph mushaf: ${hexList(lostHard)}`).toEqual([]);
  });

  it("karakter yang jatuh ke font sistem tidak berubah diam-diam", () => {
    const coveredByAny = new Set([...subsets.values()].flatMap((set) => [...set]));
    const contentChars = [...fromContent.ui, ...fromContent.arabic];
    const orphans = contentChars.filter((cp) => !coveredByAny.has(cp));
    const unexpected = orphans.filter((cp) => !SYSTEM_FONT_CHARACTERS.includes(cp));
    const stale = SYSTEM_FONT_CHARACTERS.filter((cp) => !orphans.includes(cp));
    expect(unexpected, `karakter baru yang butuh font sistem: ${hexList(unexpected, 40)}`).toEqual(
      [],
    );
    expect(stale, `allow-list usang: ${hexList(stale, 40)}`).toEqual([]);
  });
});
