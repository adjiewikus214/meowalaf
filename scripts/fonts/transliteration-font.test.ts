/**
 * Guard lintas repo untuk **fallback font transliterasi** (`src/ui/transliteration.ts`).
 *
 * Modul itu memutuskan karakter mana yang perlu font fallback, dan keputusannya
 * berdasarkan cmap font asli — data yang bisa basi diam-diam kalau font diganti.
 * Test ini mengunci dua arah sekaligus:
 *   1. setiap karakter yang dianggap "butuh fallback" memang **tidak ada** di
 *      Poppins (kalau ternyata ada, daftar itu perlu dipersempit — atau lebih baik,
 *      fallback-nya dihapus supaya teks tidak dua typeface );
 *   2. font fallback **menutupi semuanya** ( kalau tidak, ayat berisi ṣ/ṭ/ẓ akan
 *      jadi tofu).
 *
 * Plus satu bukti bahwa guard ini bukan vakum: isi terjemahan ayat di repo memang
 * memuat karakter transliterasi, jadi fallback ini dipakai, bukan teori.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { needsTransliterationFont } from "../../src/ui/transliteration";
import { readCmapCodepoints } from "./cmap.mjs";
import { FONT_PLAN, PROJECT_ROOT, collectGlyphs } from "./glyphs.mjs";

const FONT_DIR = path.join(PROJECT_ROOT, "src", "ui", "assets", "fonts");
const cmap = (file: string) => new Set(readCmapCodepoints(fs.readFileSync(path.join(FONT_DIR, file))));

const POPPINS = [...cmap("Poppins-Regular.ttf"), ...cmap("Poppins-Bold.ttf")];
const FALLBACK = cmap("NotoSans-Regular.ttf");
const POPPINS_SET = new Set(POPPINS);
const { fromContent } = collectGlyphs();

const hex = (cp: number) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
const hexList = (cps: number[]) => cps.map(hex).join(", ");

/** Karakter transliterasi yang benar-benar muncul di teks repo. */
const IN_CONTENT = [...new Set(fromContent.ui)].filter((cp) => needsTransliterationFont(String.fromCodePoint(cp)));

describe("fallback font transliterasi", () => {
  it("dipakai sungguhan: teks app memuat karakter transliterasi", () => {
    expect(IN_CONTENT.length, "tidak ada karakter transliterasi di repo — guard ini jadi vakum").toBeGreaterThan(0);
    // Sakelar: kalau karakter ini hilang, berarti data terjemahan berubah.
    expect(hexList(IN_CONTENT)).toContain("U+1E24"); // Ḥ
    expect(hexList(IN_CONTENT)).toContain("U+02BB"); // ʻ ("Syuʻbaib", "ʻArasy")
  });

  it("setiap karakter yang butuh fallback memang tidak ada di Poppins", () => {
    const redundant = IN_CONTENT.filter((cp) => POPPINS_SET.has(cp));
    expect(redundant, `Poppins sudah punya: ${hexList(redundant)}`).toEqual([]);
  });

  it("font fallback menutupi semuanya (tidak ada tofu di terjemahan ayat)", () => {
    const missing = IN_CONTENT.filter((cp) => !FALLBACK.has(cp));
    expect(missing, `glyph hilang dari NotoSans-Regular: ${hexList(missing)}`).toEqual([]);
  });

  it("file fallback adalah milik Noto Sans dan punya set transliterasi", () => {
    const plan = FONT_PLAN.find((entry) => entry.set === "translit");
    expect(plan?.file).toBe("NotoSans-Regular.ttf");
  });
});