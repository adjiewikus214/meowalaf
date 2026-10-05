import { describe, expect, it } from "vitest";

import {
  CAT_MOTION,
  CAT_MOODS,
  CAT_POSES,
  CAT_VARIANTS,
  catScene,
  type CatLayer,
  type CatMood,
  type CatPose,
  type CatVariant,
} from "./cat-art";
import { CAT_COLORS } from "./cat-palette";

/**
 * `cat-art.ts` adalah satu-satunya sumber art maskot: dipakai app
 * (`CatMascot.tsx`), pratinjau pose, dan jadi acuan ikon. Semua cacat art yang
 * mahal (angka `NaN` di path, warna di luar palet, mata tertutup yang ikut
 * berkedip) ketahuan di sini — bukan setelah dilihat user.
 */
const COMBOS: readonly { mood: CatMood; pose: CatPose; variant: CatVariant }[] = CAT_MOODS.flatMap((mood) =>
  CAT_POSES.flatMap((pose) => CAT_VARIANTS.map((variant) => ({ mood, pose, variant }))),
);

const PALETTE = new Set<string>(Object.values(CAT_COLORS));

function sceneOf(combo: { mood: CatMood; pose: CatPose; variant: CatVariant }, showMoon = false): CatLayer[] {
  return catScene({ ...combo, showMoon });
}

function numbersOf(layers: CatLayer[]): number[] {
  const values: number[] = [];
  for (const layer of layers) {
    values.push(layer.origin.x, layer.origin.y);
    for (const primitive of layer.primitives) {
      if (primitive.kind === "ellipse") values.push(primitive.cx, primitive.cy, primitive.rx, primitive.ry);
      else if (primitive.kind === "circle") values.push(primitive.cx, primitive.cy, primitive.r);
      else if (primitive.kind === "rect") values.push(primitive.x, primitive.y, primitive.width, primitive.height);
    }
  }
  return values;
}

function colorsOf(layers: CatLayer[]): string[] {
  const values: string[] = [];
  for (const layer of layers) {
    for (const primitive of layer.primitives) {
      if (primitive.kind === "path") {
        if (primitive.fill !== undefined) values.push(primitive.fill);
        if (primitive.stroke !== undefined) values.push(primitive.stroke);
      } else {
        values.push(primitive.fill);
      }
    }
  }
  return values;
}

describe("art maskot (cat-art)", () => {
  it("setiap kombinasi mood × pose × varian punya layer ber-id unik & berurutan", () => {
    for (const combo of COMBOS) {
      const layers = sceneOf(combo);
      const ids = layers.map((layer) => layer.id);
      expect(ids, `${combo.mood}/${combo.pose}/${combo.variant}`).toEqual(
        combo.pose === "wave" ? ["tail", "body", "eyes", "wave"] : ["tail", "body", "eyes"],
      );
      expect(new Set(ids).size).toBe(ids.length);
      for (const layer of layers) {
        expect(layer.primitives.length, `${layer.id} kosong`).toBeGreaterThan(0);
      }
    }
  });

  it("titik asal transformasi selalu di dalam kotak gambar (0–100)", () => {
    for (const combo of COMBOS) {
      for (const layer of sceneOf(combo)) {
        for (const value of [layer.origin.x, layer.origin.y]) {
          expect(Number.isFinite(value), `${layer.id} origin NaN`).toBe(true);
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it("tidak ada angka rusak atau perintah asing di path manapun", () => {
    for (const combo of COMBOS) {
      for (const layer of sceneOf(combo, true)) {
        for (const primitive of layer.primitives) {
          if (primitive.kind !== "path") continue;
          expect(primitive.d, `${layer.id}: ${primitive.d}`).toMatch(/^[MLCQAZ0-9 .,-]+$/i);
          expect(primitive.d).not.toMatch(/NaN|undefined|Infinity/);
        }
      }
      for (const value of numbersOf(sceneOf(combo, true))) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it("setiap warna datang dari palet brand (tidak ada hex liar)", () => {
    for (const combo of COMBOS) {
      for (const color of colorsOf(sceneOf(combo, true))) {
        expect(PALETTE, `${combo.mood}/${combo.pose}/${combo.variant}: ${color}`).toContain(color);
      }
    }
  });

  it("kedip hanya dipasang saat mata memang terbuka (idle & encourage)", () => {
    for (const combo of COMBOS) {
      const layers = sceneOf(combo);
      const eyes = layers.find((layer) => layer.id === "eyes");
      const openMood = combo.mood === "idle" || combo.mood === "encourage";
      expect(eyes?.blinkable, `mood ${combo.mood}`).toBe(openMood);
      for (const layer of layers) {
        if (layer.id !== "eyes") expect(layer.blinkable, `${layer.id} tidak boleh berkedip`).toBe(false);
      }
    }
  });

  it("pose `wave` menambah layer lengan & memindahkan kaki depan kiri ke sana", () => {
    const sit = sceneOf({ mood: "idle", pose: "sit", variant: "ash" });
    const wave = sceneOf({ mood: "idle", pose: "wave", variant: "ash" });
    const bodyPrimitives = (layers: CatLayer[]) => layers.find((layer) => layer.id === "body")?.primitives.length ?? 0;

    expect(sit.some((layer) => layer.id === "wave")).toBe(false);
    const arm = wave.find((layer) => layer.id === "wave");
    expect(arm).toBeDefined();
    // Garis luar lengan + lengan + telapak + dua garis gerak.
    expect(arm?.primitives.length).toBe(5);
    // Kaki depan kiri pindah dari badan ke layer lengan.
    expect(bodyPrimitives(wave)).toBe(bodyPrimitives(sit) - 1);
    // Pangkal lengan ada di sisi kiri badan (sisi tanpa ekor), bukan di luar kanvas.
    expect(arm?.origin.x).toBeLessThan(40);
    expect(arm?.origin.y).toBeGreaterThan(50);
  });

  it("bulan sabit ikut hanya kalau `showMoon`", () => {
    const withMoon = sceneOf({ mood: "happy", pose: "sit", variant: "ash" }, true);
    const withoutMoon = sceneOf({ mood: "happy", pose: "sit", variant: "ash" }, false);
    const goldMoon = (layers: CatLayer[]) =>
      layers.some((layer) =>
        layer.primitives.some((primitive) => primitive.kind === "path" && primitive.fill === CAT_COLORS.gold && primitive.d.includes("A15")),
      );
    expect(goldMoon(withMoon)).toBe(true);
    expect(goldMoon(withoutMoon)).toBe(false);
  });

  it("angka gerak masuk akal (positif, cheer lebih hidup dari tenang)", () => {
    expect(CAT_MOTION.tailMs).toBeGreaterThan(0);
    expect(CAT_MOTION.breatheMs).toBeGreaterThan(0);
    expect(CAT_MOTION.cheerTailMs).toBeLessThan(CAT_MOTION.tailMs);
    expect(CAT_MOTION.cheerBreatheMs).toBeLessThan(CAT_MOTION.breatheMs);
    expect(CAT_MOTION.blinkCloseMs).toBeGreaterThan(0);
    expect(CAT_MOTION.blinkOpenMs).toBeGreaterThan(0);
    expect(CAT_MOTION.waveSwingDeg).toBeGreaterThan(0);
    expect(CAT_MOTION.blinkSquash).toBeGreaterThan(0);
    expect(CAT_MOTION.blinkSquash).toBeLessThan(1);
    expect(CAT_MOTION.walkMs).toBeGreaterThan(0);
    expect(CAT_MOTION.walkShift).toBeGreaterThan(0);
    expect(CAT_MOTION.walkShift).toBeLessThan(1);
  });
});
