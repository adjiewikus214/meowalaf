/**
 * Owner: ui. Token non-warna (warna via tailwind.config.js, sumber sama DESIGN.md § 2).
 * ui tidak boleh meng-import features/core (eslint boundary).
 */

/** Skala teks Arab (PRD § 5.3, DESIGN.md § 3) — tipe dimiliki ui, dipakai core via import type. */
export type ArabicFontScale = "S" | "M" | "L";
export const ARAB_FONT_SIZES: Record<ArabicFontScale, number> = { S: 22, M: 28, L: 34 };
export const ARAB_LINE_HEIGHT_RATIO = 1.9;

export const TOUCH_TARGET = 44;

/** Motion (DESIGN.md § 6) — dipakai reanimated nanti, sekarang duration standar. */
export const MOTION = { fast: 150, base: 220, slow: 300 } as const;
