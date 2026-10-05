/**
 * Owner: ui. **Art maskot Abu sebagai data murni** (`cat-art.ts`).
 *
 * Kenapa art dipisah dari komponen:
 *   1. **Pratinjau semua pose** (`npm run brand:mascot-preview`) bisa memakai art
 *      yang SAMA PERSIS dengan yang dirender app — bukan salinan yang cepat basi.
 *      Dipakai juga oleh `scripts/brand/render-icons.mjs` sebagai acuan peta
 *      koordinat (ikon app menggambar karakter yang sama).
 *   2. Modal ini murni (tanpa React/React Native), jadi bisa diuji vitest tanpa
 *      stub, dan bug art (angka `NaN` di path, warna di luar palet) ketahuan test.
 *   3. Komponen tinggal jadi renderer: layer → elemen SVG + animasi.
 *
 * Peta koordinat: 0–200 untuk sumbu x & y, titik (0,0) di kiri atas. Semua angka
 * di bawah boleh dibaca sebagai "peta wajah": mata di y≈76, moncong y≈94,
 * kitab y≈140–160, badan y≈58–172.
 */
import { CAT_COLORS } from "./cat-palette";

export type CatMood = "idle" | "happy" | "cheer" | "encourage" | "sleepy" | "wink";
export type CatVariant = "ash" | "cream";
/** Pose badan: duduk memeluk kitab, atau duduk sambil melambai. */
export type CatPose = "sit" | "wave";
/** Animasi masuk satu kali saat maskot pertama tampil. */
export type CatEntrance = "none" | "walk";

export const CAT_MOODS: readonly CatMood[] = ["idle", "happy", "cheer", "encourage", "sleepy", "wink"];
export const CAT_POSES: readonly CatPose[] = ["sit", "wave"];
export const CAT_VARIANTS: readonly CatVariant[] = ["ash", "cream"];
export const CAT_ENTRANCES: readonly CatEntrance[] = ["none", "walk"];

/**
 * Angka gerak maskot — **satu sumber** untuk komponen (`CatMascot.tsx`) dan
 * pratinjau pose (`scripts/brand/mascot-preview.ts`). Kalau durasi di sini
 * berubah, pratinjau ikut berubah: tidak ada salinan CSS yang bisa basi.
 *
 * Semua nilai dalam milidetik; `waveSwingDeg` & `tailSwingDeg` = amplitudo
 * penuh (setengah ke kiri, setengah ke kanan).
 */
export const CAT_MOTION = {
  /** Ekor & napas saat tenang. */
  tailMs: 1700,
  breatheMs: 2900,
  /** Ekor & napas saat `cheer` — momen selesai lesson, jadi lebih hidup. */
  cheerTailMs: 900,
  cheerBreatheMs: 1300,
  tailSwingDeg: 8,
  /** Kedip mata: jeda tenang, lalu tutup–buka cepat. Hanya mood bermata terbuka. */
  blinkPauseMs: 2600,
  blinkCloseMs: 110,
  blinkOpenMs: 150,
  blinkSquash: 0.9,
  /** Lambaian tangan: ayunan bolak-balik dari pangkal bahu. */
  waveMs: 460,
  waveSwingDeg: 14,
  /** Berjalan masuk: satu kali saat maskot pertama tampil. */
  walkMs: 700,
  /** Jarak awal di luar kotak, sebagai pecahan `size`. */
  walkShift: 0.55,
  /** Tinggi lompatan kecil saat berjalan masuk (px pada peta 0–200). */
  walkHop: 3,
} as const;

/** Elemen gambar yang didukung renderer (RN & HTML). */
export type CatPrimitive =
  | {
      kind: "path";
      d: string;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      opacity?: number;
      strokeLinecap?: "round";
    }
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number; fill: string; opacity?: number }
  | { kind: "circle"; cx: number; cy: number; r: number; fill: string; opacity?: number }
  | { kind: "rect"; x: number; y: number; width: number; height: number; rx?: number; fill: string };

export type CatLayer = {
  /** Id stabil: dipakai komponen untuk memilih animasi, dan oleh test. */
  id: "tail" | "body" | "eyes" | "wave";
  /**
   * Titik asal transformasi dalam persen kotak gambar (0–100). Animasi dijalankan
   * di `View` pembungkus, jadi nilai ini yang membuat ekor berayun dari
   * pangkalnya dan mata berkedip dari garis matanya.
   */
  origin: { x: number; y: number };
  /** true = layer mata bisa berkedip (mata terbuka), false = mata sudah tertutup. */
  blinkable: boolean;
  primitives: CatPrimitive[];
};

// ---- geometri (peta 200×200) -------------------------------------------------

export const TAIL_BASE = { x: 132, y: 158 };
/**
 * Pangkal tangan yang melambai. **Sisi kiri** badan, bukan kanan: ekor memang
 * ada di kanan, dan lengan yang diangkat di sisi itu langsung menabrak
 * lengkung ekor (ketahuan dari pratinjau visual, bukan dari test). Sisi kiri
 * bersih, jadi lengan terbaca sebagai lengan.
 */
export const WAVE_SHOULDER = { x: 62, y: 140 };
const TAIL_PATH = "M132 158 C156 162 178 146 172 124 C167 106 146 104 141 118";
const BODY_PATH =
  "M100 58 C134 58 154 92 154 126 C154 154 131 172 100 172 C69 172 46 154 46 126 C46 92 66 58 100 58 Z";
const BELLY_PATH =
  "M100 96 C124 96 136 122 132 144 C128 162 115 170 100 170 C85 170 72 162 68 144 C64 122 76 96 100 96 Z";
const BOOK_LEFT = "M100 141 C88 135 74 135 62 139 L62 158 C74 154 88 154 100 160 Z";
const BOOK_RIGHT = "M100 141 C112 135 126 135 138 139 L138 158 C126 154 112 154 100 160 Z";
const EAR_LEFT = "M58 66 C54 48 58 32 66 26 C78 32 88 44 92 56 Z";
const EAR_LEFT_INNER = "M66 60 C64 48 67 38 71 33 C78 39 84 48 87 56 Z";
const EAR_RIGHT = "M142 66 C146 48 142 32 134 26 C122 32 112 44 108 56 Z";
const EAR_RIGHT_INNER = "M134 60 C136 48 133 38 129 33 C122 39 116 48 113 56 Z";
const CAP_DOME = "M72 44 C72 19 128 19 128 44 Z";
const MOON = "M180 30 A15 15 0 1 1 163 8 A12 12 0 0 0 180 30 Z";
const STAR = "M170 48 L172.5 53 L178 55 L172.5 57 L170 62 L167.5 57 L162 55 L167.5 53 Z";
/** Tangan melambai: lengan dari bahu ke telapak yang terangkat di samping pipi. */
const WAVE_ARM = "M62 140 C50 130 46 112 46 94";
const WAVE_PAW = { cx: 46, cy: 78, rx: 13, ry: 12 };
const WAVE_MOTION = ["M24 60 C20 64 20 70 24 74", "M18 80 C14 84 14 90 18 94"];

const WHISKERS_LEFT = ["M66 84 L34 78", "M64 90 L30 90", "M66 96 L34 102"];
const WHISKERS_RIGHT = ["M134 84 L166 78", "M136 90 L170 90", "M134 96 L166 102"];

/** Warna bulu & bagian terang, menurut varian. */
function furOf(variant: CatVariant): { fur: string; furDeep: string; light: string } {
  return {
    fur: variant === "cream" ? CAT_COLORS.furCream : CAT_COLORS.furAsh,
    furDeep: variant === "cream" ? CAT_COLORS.furCreamDeep : CAT_COLORS.furAshDeep,
    light: CAT_COLORS.light,
  };
}

function eyePrimitives(mood: CatMood): { primitives: CatPrimitive[]; blinkable: boolean } {
  const openEye = (cx: number): CatPrimitive[] => [
    { kind: "ellipse", cx, cy: 76, rx: 9, ry: 10, fill: CAT_COLORS.eye },
    { kind: "ellipse", cx, cy: 76, rx: 4, ry: 7, fill: CAT_COLORS.ink },
    { kind: "circle", cx: cx + 3, cy: 71.5, r: 2.4, fill: CAT_COLORS.light, opacity: 0.9 },
  ];
  const closedEye = (cx: number): CatPrimitive => ({
    kind: "path",
    d: `M${cx - 8} 79 Q${cx} 69 ${cx + 8} 79`,
    stroke: CAT_COLORS.ink,
    strokeWidth: 4,
    strokeLinecap: "round",
  });
  const sleepyEye = (cx: number): CatPrimitive => ({
    kind: "path",
    d: `M${cx - 8} 78 Q${cx} 84 ${cx + 8} 78`,
    stroke: CAT_COLORS.ink,
    strokeWidth: 3.5,
    strokeLinecap: "round",
  });

  switch (mood) {
    case "sleepy":
      return { primitives: [sleepyEye(86), sleepyEye(114)], blinkable: false };
    case "wink":
      return { primitives: [...openEye(86), closedEye(114)], blinkable: false };
    case "happy":
    case "cheer":
      return { primitives: [closedEye(86), closedEye(114)], blinkable: false };
    default:
      // idle & encourage: mata terbuka — inilah yang bisa berkedip.
      return { primitives: [...openEye(86), ...openEye(114)], blinkable: true };
  }
}

/** Hidung + mulut, tergantung mood (senyum dua lengkung, mulut terbuka, atau moncong kecil). */
function mouthPrimitives(mood: CatMood): CatPrimitive[] {
  const nose: CatPrimitive = { kind: "path", d: "M94 84 Q100 81 106 84 Q100 92 94 84 Z", fill: CAT_COLORS.blush };
  if (mood === "cheer") {
    return [
      nose,
      { kind: "ellipse", cx: 100, cy: 98, rx: 9, ry: 8, fill: CAT_COLORS.ink },
      { kind: "ellipse", cx: 100, cy: 102, rx: 5, ry: 3.5, fill: CAT_COLORS.blush },
    ];
  }
  if (mood === "sleepy") {
    return [
      nose,
      { kind: "path", d: "M96 94 Q100 98 104 94", stroke: CAT_COLORS.ink, strokeWidth: 2.6, strokeLinecap: "round" },
    ];
  }
  return [
    nose,
    { kind: "path", d: "M100 90 Q94 98 88 92", stroke: CAT_COLORS.ink, strokeWidth: 2.6, strokeLinecap: "round" },
    { kind: "path", d: "M100 90 Q106 98 112 92", stroke: CAT_COLORS.ink, strokeWidth: 2.6, strokeLinecap: "round" },
  ];
}

/**
 * Susun seluruh scene maskot menjadi layer siap-render.
 *
 * Urutan layer = urutan gambar (tail paling belakang, lalu badan, lalu mata,
 * lalu lengan yang melambai). Komponen hanya perlu memetakan layer ini ke
 * elemen SVG dan memasang animasi per `id`.
 */
export function catScene(input: {
  mood: CatMood;
  variant: CatVariant;
  pose: CatPose;
  showMoon: boolean;
}): CatLayer[] {
  const { mood, variant, pose, showMoon } = input;
  const { fur, furDeep, light } = furOf(variant);
  const eyes = eyePrimitives(mood);

  const tail: CatLayer = {
    id: "tail",
    origin: { x: (TAIL_BASE.x / 200) * 100, y: (TAIL_BASE.y / 200) * 100 },
    blinkable: false,
    primitives: [
      { kind: "path", d: TAIL_PATH, stroke: furDeep, strokeWidth: 13, strokeLinecap: "round" },
      { kind: "path", d: TAIL_PATH, stroke: fur, strokeWidth: 8, strokeLinecap: "round", opacity: 0.55 },
      {
        kind: "path",
        d: "M146 112 C152 112 156 116 158 122",
        stroke: light,
        strokeWidth: 5,
        strokeLinecap: "round",
        opacity: 0.8,
      },
    ],
  };

  const body: CatLayer = {
    id: "body",
    origin: { x: 50, y: 100 },
    blinkable: false,
    primitives: [
      ...(showMoon
        ? ([
            { kind: "path", d: MOON, fill: CAT_COLORS.gold },
            { kind: "path", d: STAR, fill: CAT_COLORS.gold },
          ] satisfies CatPrimitive[])
        : []),
      { kind: "path", d: EAR_LEFT, fill: fur },
      { kind: "path", d: EAR_LEFT_INNER, fill: CAT_COLORS.blush },
      { kind: "path", d: EAR_RIGHT, fill: fur },
      { kind: "path", d: EAR_RIGHT_INNER, fill: CAT_COLORS.blush },
      { kind: "path", d: BODY_PATH, fill: fur },
      { kind: "path", d: BELLY_PATH, fill: light },
      { kind: "ellipse", cx: 70, cy: 166, rx: 17, ry: 10, fill: fur },
      { kind: "ellipse", cx: 130, cy: 166, rx: 17, ry: 10, fill: fur },
      { kind: "path", d: BOOK_LEFT, fill: light, stroke: furDeep, strokeWidth: 1.4 },
      { kind: "path", d: BOOK_RIGHT, fill: light, stroke: furDeep, strokeWidth: 1.4 },
      { kind: "path", d: "M100 141 L100 160", stroke: furDeep, strokeWidth: 2 },
      {
        kind: "path",
        d: "M62 158 C76 152 90 154 100 160 C110 154 124 152 138 158",
        stroke: CAT_COLORS.gold,
        strokeWidth: 3,
        strokeLinecap: "round",
      },
      // Kaki depan: kanan selalu memeluk kitab; kiri hanya saat TIDAK melambai
      // (saat melambai, kaki kiri pindah ke layer `wave`).
      ...(pose === "wave" ? [] : ([{ kind: "ellipse", cx: 80, cy: 150, rx: 13, ry: 10, fill: light }] satisfies CatPrimitive[])),
      { kind: "ellipse", cx: 120, cy: 150, rx: 13, ry: 10, fill: light },
      { kind: "ellipse", cx: 100, cy: 80, rx: 46, ry: 42, fill: fur },
      { kind: "ellipse", cx: 100, cy: 94, rx: 27, ry: 19, fill: light, opacity: 0.9 },
      { kind: "path", d: CAP_DOME, fill: CAT_COLORS.cap },
      { kind: "rect", x: 70, y: 39, width: 60, height: 10, rx: 4, fill: light },
      { kind: "path", d: "M85 42 L88.5 44 L85 46 L81.5 44 Z", fill: CAT_COLORS.gold },
      { kind: "path", d: "M100 42 L103.5 44 L100 46 L96.5 44 Z", fill: CAT_COLORS.gold },
      { kind: "path", d: "M115 42 L118.5 44 L115 46 L111.5 44 Z", fill: CAT_COLORS.gold },
      ...WHISKERS_LEFT.map((d): CatPrimitive => ({ kind: "path", d, stroke: CAT_COLORS.ink, strokeWidth: 2, strokeLinecap: "round", opacity: 0.32 })),
      ...WHISKERS_RIGHT.map((d): CatPrimitive => ({ kind: "path", d, stroke: CAT_COLORS.ink, strokeWidth: 2, strokeLinecap: "round", opacity: 0.32 })),
      { kind: "ellipse", cx: 68, cy: 92, rx: 9, ry: 6, fill: CAT_COLORS.blush, opacity: 0.5 },
      { kind: "ellipse", cx: 132, cy: 92, rx: 9, ry: 6, fill: CAT_COLORS.blush, opacity: 0.5 },
      ...mouthPrimitives(mood),
    ],
  };

  const eyesLayer: CatLayer = {
    id: "eyes",
    origin: { x: 50, y: 38 },
    blinkable: eyes.blinkable,
    primitives: eyes.primitives,
  };

  const layers: CatLayer[] = [tail, body, eyesLayer];

  if (pose === "wave") {
    layers.push({
      id: "wave",
      origin: { x: (WAVE_SHOULDER.x / 200) * 100, y: (WAVE_SHOULDER.y / 200) * 100 },
      blinkable: false,
      primitives: [
        // Lengan digambar dengan garis luar (`furDeep`) seperti ekor: tanpa itu,
        // bulu lengan yang sewarna badan hilang begitu menutupi badan.
        { kind: "path", d: WAVE_ARM, stroke: furDeep, strokeWidth: 14, strokeLinecap: "round" },
        { kind: "path", d: WAVE_ARM, stroke: fur, strokeWidth: 10, strokeLinecap: "round" },
        { kind: "ellipse", cx: WAVE_PAW.cx, cy: WAVE_PAW.cy, rx: WAVE_PAW.rx, ry: WAVE_PAW.ry, fill: light },
        ...WAVE_MOTION.map((d): CatPrimitive => ({
          kind: "path",
          d,
          stroke: CAT_COLORS.ink,
          strokeWidth: 2,
          strokeLinecap: "round",
          opacity: 0.22,
        })),
      ],
    });
  }

  return layers;
}
