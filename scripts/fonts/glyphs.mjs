/**
 * Inventaris glyph Ayatin — satu-satunya sumber kebenaran untuk subset font.
 *
 * Prinsip: subset berisi **hanya glyph yang benar-benar dirender app**, dan itu
 * dihitung dari isi repo, bukan ditebak:
 *
 *  - `ui`     -> Plus Jakarta Sans (body) & Space Grotesk (`font-display`).
 *                Setiap karakter non-Arab yang muncul di app/ dan src/ — kode
 *                (label, tombol, format angka) maupun data konten (terjemahan,
 *                nama surah, glos).
 *  - `arabic` -> Amiri (`font-arab`, teks mushaf). Semua karakter Arab di repo,
 *                termasuk yang hanya muncul setelah `content:build` dijalankan
 *                ulang. Ditambah rentang dasar Latin/angka karena teks Arab
 *                kadang bercampur angka ("Surah Al-Ikhlas 112").
 *
 * Kenapa tidak "blok Arab penuh"? Itu-variant_full diukur 166 KB gzip untuk Amiri
 * vs 76 KB untuk korpus sebenarnya — 90 KB ekstra untuk teks Arab yang tidak
 * pernah muncul. Kalaumu mau-Itu, jalankan `npm run fonts:subset -- --with-arabic-blocks`.
 *
 * Keamanannya ada di test, bukan di ukuran: scripts/fonts/subset-fonts.test.ts
 * gagal kalau isi data berubah tapi subset belum dibangun ulang. Karakter yang
 * tidak ada di font mana pun (CJK, emoji, Siril) memang sudah jatuh ke font
 * sistem sebelum subset — perilaku itu tidak berubah.
 *
 * Dipakai oleh: scripts/fonts/subset-fonts.mjs (build) dan
 * scripts/fonts/subset-fonts.test.ts (regresi). Jangan diedit terpisah-sendiri.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Kodeepoint inklusif. */
function range(from, to) {
  const out = [];
  for (let cp = from; cp <= to; cp += 1) out.push(cp);
  return out;
}

/**
 * Rentang dasar Latin + angka + tanda baca tipografis. Murah (ratusan glyph),
 * dan menutup nama yang diketik user, angka streak/XP, serta simbol UI.
 */
export const UI_BASE_RANGES = [
  [0x0020, 0x007e], // ASCII cetak
  [0x00a0, 0x00ff], // Latin-1 Supplement: § × · ° ± ¼
  [0x0100, 0x017f], // Latin Extended-A: ā ī ū ż Ż
  [0x01bb, 0x01bb], // ʻ modifier letter
  [0x02bb, 0x02bb], // ʻ turned comma (transliterasi Indonesia)
  [0x1e00, 0x1eff], // Latin Extended Additional: Ḥ ḥ ṣ Ṭ ṡ Ṣ ṭ ẓ
  [0x2000, 0x206f], // General Punctuation: “ ” ‘ ’ – — … •
  [0x2070, 0x209f], // Superscripts & subscripts: ¹ ² ³ ₀
  [0x20a0, 0x20bf], // Currency: Rp
  [0x2100, 0x214f], // Letterlike Symbols: № ™ ℓ
  [0x2190, 0x21ff], // Arrows: → ↔ ↑ ↓
  [0x2200, 0x22ff], // Math: − ≠ ≤ ≥ ≈ ∞
  [0x25a0, 0x25ff], // Geometric Shapes: ▶ ▲ ▼ ▢
  [0x2600, 0x27bf], // Misc Symbols + Dingbats: ✓ ✔ ✕ ✖ ⚠ ⚡ ➜ ✨
  [0x2b00, 0x2b5f], // Misc Symbols and Arrows: ⭐
  [0xfb00, 0xfb06], // Alphabetic Presentation Forms (fi/fl ligature)
];

/** Semua blok Arab (huruf, harakat, anotasi Quran, digit Arab-Indic). */
export const ARABIC_BLOCK_RANGES = [
  [0x0600, 0x06ff],
  [0x0750, 0x077f],
  [0x08a0, 0x08ff],
];

/**
 * Klasifikasi karakter **transliterasi Arab** — dipakai untuk menghitung glyph
 * mana yang harus ada di font fallback.
 *
 * Poppins (body + judul) tidak punya huruf ber-titik (Ḥ ṣ Ṭ ẓ), tanda
 * penghubung (macron dll.), maupun ʻ ("Syuʻbaib", "ʻArasy") — padahal
 * terjemahan ayat memakainya di ratusan ayat.
 *
 * PENTING: rentang ini hanya **pengklasifikasi**. Glyph yang benar-benar
 * disalin ke font fallback diambil dari karakter yang **benar-benar muncul di
 * teks repo** (lihat `fromContent.translit`), bukan seluruh rentang: subset
 * satu blok Latin Extended + combining marks dari Noto Sans berukuran 20,5 KB
 * gzip, sedangkan 12 glyph yang benar-benar dipakai cuma 2,1 KB — dan semua
 * font ini diunduh saat startup.
 */
export const TRANSLITERATION_RANGES = [
  [0x02bb, 0x02bb], // MODIFIER LETTER TURNED COMMA: "Syuʻbaib", "ʻArasy"
  [0x0300, 0x036f], // Combining Diacritical Marks (macron dll. pada transliterasi)
  [0x1e00, 0x1eff], // Latin Extended Additional: H/S/T/Z dengan titik
];

/** Kontrol arah + ZWNJ/ZWJ: shaping Arab butuh ini, dan lebarnya nol. */
const BIDI_RANGES = [
  [0x200c, 0x200f],
  [0x061c, 0x061c],
];

const SCAN_ROOTS = ["app", "src"];
const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".json"]);
const SCAN_SKIP_DIRS = new Set(["node_modules", "dist", ".vercel", ".expo", "_source"]);
/** Font asli sengaja tidak ikut dipindai (binari, bukan teks UI). */
const SKIP_FILES = new Set(["package-lock.json"]);

function listSourceFiles() {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SCAN_SKIP_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
        continue;
      }
      if (!SCAN_EXTENSIONS.has(path.extname(entry.name))) continue;
      if (SKIP_FILES.has(entry.name)) continue;
      files.push(path.join(dir, entry.name));
    }
  };
  for (const root of SCAN_ROOTS) {
    const abs = path.join(ROOT, root);
    if (!fs.existsSync(abs)) continue;
    walk(abs);
  }
  return files.sort();
}

/** Kodeepoint Arab: blok utama, extended, dan bentuk presentasi (FB/FE). */
export function isArabicCodePoint(cp) {
  return (
    (cp >= 0x0600 && cp <= 0x06ff) ||
    (cp >= 0x0750 && cp <= 0x077f) ||
    (cp >= 0x08a0 && cp <= 0x08ff) ||
    (cp >= 0xfb50 && cp <= 0xfdff) ||
    (cp >= 0xfe70 && cp <= 0xfefc)
  );
}

const fromRanges = (ranges) => ranges.flatMap(([from, to]) => range(from, to));

/**
 * Kumpulkan seluruh glyph yang bisa dirender app.
 * @param {{ fullArabicBlocks?: boolean }} [options] `fullArabicBlocks` menahan
 *   Amiri di seluruh blok Arab, bukan hanya korpus repo.
 * @returns {{ ui: number[], arabic: number[], translit: number[], fromContent: { ui: number[], arabic: number[], translit: number[] }, sourceFileCount: number }}
 *   `fromContent` = glyph yang benar-benar muncul di teks app; itu yang perlu
 *   dilaporkan kalau tidak bisa dilayani font mana pun. Padding range di atas
 *   bukan laporan — glyph yang tidak ada di font asli memang gratis.
 */
export function collectGlyphs({ fullArabicBlocks = false } = {}) {
  const ui = new Set(fromRanges(UI_BASE_RANGES));
  const arabic = new Set([
    ...fromRanges(BIDI_RANGES),
    ...range(0x0020, 0x007e), // ASCII: angka + tanda baca di teks Arab
    ...range(0x00a0, 0x00ff),
    ...range(0x2000, 0x206f),
  ]);
  if (fullArabicBlocks) {
    for (const cp of fromRanges(ARABIC_BLOCK_RANGES)) arabic.add(cp);
  }
  const fromContentUi = new Set();
  const fromContentArabic = new Set();
  const translitSet = new Set(fromRanges(TRANSLITERATION_RANGES));
  const fromContentTranslit = new Set();
  const files = listSourceFiles();

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const char of text) {
      const cp = char.codePointAt(0);
      if (cp === 0xfeff) continue; // BOM
      if (cp < 0x20) continue; // kontrol
      if (isArabicCodePoint(cp)) {
        arabic.add(cp);
        fromContentArabic.add(cp);
      } else {
        ui.add(cp);
        fromContentUi.add(cp);
        // Hanya karakter transliterasi yang BENAR-BENAR muncul di teks app yang
        // dilaporkan ke font fallback — bukan seluruh rentang Latin Extended.
        if (translitSet.has(cp)) fromContentTranslit.add(cp);
      }
    }
  }

  return {
    ui: [...ui].sort((a, b) => a - b),
    arabic: [...arabic].sort((a, b) => a - b),
    translit: [...fromContentTranslit].sort((a, b) => a - b),
    fromContent: {
      ui: [...fromContentUi].sort((a, b) => a - b),
      arabic: [...fromContentArabic].sort((a, b) => a - b),
      translit: [...fromContentTranslit].sort((a, b) => a - b),
    },
    sourceFileCount: files.length,
  };
}

/**
 * Font mana yang memakai set glyph apa. `src/ui/assets/fonts/_source` menyimpan
 * font asli; hasil subset ditulis ke `src/ui/assets/fonts` dengan nama file sama
 * supaya FONT_MAP di app/_layout.tsx tidak berubah.
 *
 * Plus Jakarta Sans **tidak** ikut lagi: setelah body & judul pindah ke
 * Poppins, satu-satunya sisa tugasnya adalah fallback transliterasi (lihat
 * `TRANSLITERATION_RANGES` & `src/ui/transliteration.ts`), dan Noto Sans
 * menutupi 12/12 glyph yang dipakai (Poppins: 0/12; Plus Jakarta Sans: 8/12 —
 * misses ʻ, ̓, dan ḣ).
 *
 * Poppins SemiBold/Medium sengaja tidak ada di sini: tidak ada satu pun
 * `font-weight`/`font-bold` di app, jadi weight lain tidak pernah dirender
 * (lihat docs/PERF.md).
 */
export const FONT_PLAN = [
  { file: "Amiri-Regular.ttf", set: "arabic", role: "teks mushaf (`font-arab`)" },
  { file: "Poppins-Regular.ttf", set: "ui", role: "body app (`--font-sans`)" },
  { file: "Poppins-Bold.ttf", set: "ui", role: "judul & angka besar (`--font-display`)" },
  {
    file: "NotoSans-Regular.ttf",
    set: "translit",
    role: "fallback transliterasi Arab saja (`--font-translit`)",
  },
];

export { ROOT as PROJECT_ROOT };