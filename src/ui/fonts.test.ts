import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard token font (`global.css`).
 *
 * Dua hal yang tidak bisa dijaga TypeScript dan pernah membuat app salah diam-diam:
 *   1. **Override react-native-web.** Setiap `<Text>` dapat rule `font:` milik
 *      RNW (font sistem). Tanpa override di `global.css`, `--font-sans` hanya
 *      berlaku untuk elemen non-Text dan seluruh body text dirender font sistem —
 *      ini yang terjadi sebelum guard ini ada.
 *   2. **Token menunjuk file yang tidak ada** (mis. sempat tertinggal
 *      `PlusJakartaSans-Regular` setelah font-nya diganti), dan build baru gagal
 *      jauh dari penyebabnya.
 */
const ROOT = path.resolve(import.meta.dirname, "..", "..");
const GLOBAL_CSS = fs.readFileSync(path.join(ROOT, "global.css"), "utf8");
const LAYOUT = fs.readFileSync(path.join(ROOT, "app", "_layout.tsx"), "utf8");
const FONT_DIR = path.join(ROOT, "src", "ui", "assets", "fonts");

/** `--font-<nama>: "<file>"` → nama & file. */
function fontTokens(): { name: string; file: string }[] {
  const out: { name: string; file: string }[] = [];
  for (const match of GLOBAL_CSS.matchAll(/--font-([a-z0-9-]+):\s*"([^"]+)"/g)) {
    out.push({ name: match[1] ?? "", file: match[2] ?? "" });
  }
  return out;
}

const tokens = fontTokens();

describe("token font di global.css", () => {
  it("mendefinisikan body, display, arab, dan translit", () => {
    expect(tokens.map((token) => token.name).sort()).toEqual(["arab", "display", "sans", "translit"]);
  });

  it("override react-native-web ada untuk body dan tiap token", () => {
    // Rule bawaan: font RNW di element Text harus kalah dari --font-sans.
    expect(GLOBAL_CSS).toMatch(/\[dir\]\s*\{\s*font-family:\s*var\(--font-sans\)\s*!important;/);
    for (const token of tokens) {
      expect(
        GLOBAL_CSS,
        `token --font-${token.name} tidak punya baris override \`font-family: var(--font-${token.name})\``,
      ).toMatch(new RegExp(`font-family:\\s*var\\(--font-${token.name}\\)\\s*!important;`));
    }
  });

  it("ikon glyph dikecualikan dari override body font", () => {
    // Bug nyata (ketahuan lewat computed style saat shortcut Yasin dibuat):
    // override `[dir]` pakai !important, jadi ia menimpa `font-family: ionicons`
    // yang dipasang inline oleh @expo/vector-icons. Glyph-nya di Private Use
    // Area, jadi yang tampil KOTAK KOSONG — kelihatan seperti ikon hilang.
    expect(GLOBAL_CSS).toMatch(/\.font-ionicons\s*\{\s*font-family:\s*ionicons\s*!important;/);
    // Dan wrapper ikon WAJIB menempelkan kelas itu — tanpa itu baris CSS di atas
    // tidak pernah match apa pun.
    const ICONS = fs.readFileSync(path.join(ROOT, "src", "ui", "icons.tsx"), "utf8");
    expect(ICONS, "src/ui/icons.tsx harus menambahkan font-ionicons ke setiap ikon").toContain(
      "font-ionicons",
    );
  });

  it("setiap token menunjuk file font yang benar-benar ada", () => {
    for (const token of tokens) {
      expect(fs.existsSync(path.join(FONT_DIR, `${token.file}.ttf`)), `${token.file}.ttf tidak ada`).toBe(true);
      // Dan file itu harus termuat saat app start, kalau tidak tokennya berbohong.
      expect(LAYOUT, `${token.file} tidak ada di FONT_MAP`).toContain(`"${token.file}"`);
    }
  });
});