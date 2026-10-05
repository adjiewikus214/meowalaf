/**
 * Owner: ui. Palet maskot kucing (BRAND.md § 3–4) sebagai nilai hex, untuk
 * `react-native-svg`.
 *
 * Kenapa ada file terpisah, bukan className Tailwind seperti komponen lain:
 * **SVG tidak menerima className Tailwind** — ia butuh nilai warna langsung di
 * prop `fill`/`stroke`. Supaya warna maskot tetap punya satu sumber kebenaran,
 * nilai di sini adalah **cermin token `cat/*` di global.css**, dan
 * `cat-palette.test.ts` gagal kalau keduanya berbeda. Jadi bukan duplikasi
 * bebas: ia dijaga test, bukan disiplin manual.
 *
 * Modul ini murni (tanpa React/React Native) supaya bisa diuji di vitest tanpa
 * stub apa pun dan dipakai ulang oleh komponen.
 */
export const CAT_COLORS = {
  /** Bulu Abu — British Shorthair abu-abu. */
  furAsh: "#98A4AD",
  /** Bulu bagian dalam telinga belakang, ekor, garis buku. */
  furAshDeep: "#78858F",
  /** Bulu varian kucing putih. */
  furCream: "#F2EEE6",
  furCreamDeep: "#D8D2C7",
  /** Dada, moncong, kuku — selalu lebih terang dari bulu. */
  light: "#FBF8F3",
  /** Pipi, hidung, lidah. */
  blush: "#E79F9A",
  /** Mata tembaga khas BSH. */
  eye: "#D08A3E",
  /** Pupil, garis mata, mulut, kumis. */
  ink: "#232B2F",
  /** Peci (kopiah) — keputusan produk, lihat BRAND.md § 6. */
  cap: "#6FA9C0",
  /** Aksen islami: bulan sabit, bintang, tepi buku. */
  gold: "#E0B44A",
} as const;

export type CatColorKey = keyof typeof CAT_COLORS;

/** Token `global.css` yang menjadi sumber nilai setiap warna di atas. */
export const CAT_COLOR_TOKENS: Record<CatColorKey, string> = {
  furAsh: "cat-ash",
  furAshDeep: "cat-ash-deep",
  furCream: "cat-cream",
  furCreamDeep: "cat-cream-deep",
  light: "cat-light",
  blush: "cat-blush",
  eye: "cat-eye",
  ink: "cat-ink",
  cap: "cat-cap",
  gold: "gold",
};
