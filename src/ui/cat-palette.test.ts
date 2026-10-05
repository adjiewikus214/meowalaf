import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { CAT_COLORS, CAT_COLOR_TOKENS } from "./cat-palette";

const GLOBAL_CSS = fs.readFileSync(path.resolve(import.meta.dirname, "..", "..", "global.css"), "utf8");

/**
 * Warna maskot dipakai sebagai nilai hex di prop `fill`/`stroke` SVG (SVG tidak
 * menerima className Tailwind), jadi ia TIDAK bisa dijaga TypeScript. Yang bisa
 * dijaga: keduanya tetap sinkron dengan token di `global.css`. Kalau suatu saat
 * palet brand berubah tapi maskot tidak, test ini gagal — bukan diam-diam.
 */
describe("palet maskot kucing", () => {
  it("setiap warna SVG punya token global.css dengan nilai yang sama", () => {
    for (const [key, token] of Object.entries(CAT_COLOR_TOKENS)) {
      const match = new RegExp(`--color-${token}:\\s*(#[0-9a-fA-F]{6})`).exec(GLOBAL_CSS);
      expect(match, `token --color-${token} tidak ada di global.css`).not.toBeNull();
      const hex = CAT_COLORS[key as keyof typeof CAT_COLORS];
      expect(match?.[1]?.toLowerCase(), `--color-${token} berbeda dari CAT_COLORS.${key}`).toBe(hex.toLowerCase());
    }
  });

  it("semua nilai adalah hex 6 digit dan tidak ada yang duplikat", () => {
    const values = Object.values(CAT_COLORS);
    for (const value of values) expect(value).toMatch(/^#[0-9a-f]{6}$/i);
    // Duplikat bukan kesalahan fatal, tapi tanda palet membengkak tanpa alasan.
    expect(new Set(values).size).toBe(values.length);
  });
});
