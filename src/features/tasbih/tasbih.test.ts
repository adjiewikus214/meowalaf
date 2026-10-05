/**
 * Test modul PURE tasbih (ARCHITECTURE.md § 8 lapisan unit). Tanpa React,
 * tanpa storage: aturan hadiah & roll harian harus bisa dibuktikan sendirian,
 * karena inilah bagian yang menentukan XP dan streak user.
 */
import { describe, expect, it } from "vitest";

import {
  TASBIH_DEFAULT_TARGET,
  TASBIH_PRESETS,
  TASBIH_XP_PER_PRESET,
  TASBIH_XP_TARGET,
  applyTap,
  getTasbihPreset,
  initialTasbihDay,
  presetRoundProgress,
  rollTasbihDay,
  tasbihTotal,
  withTarget,
  type TasbihDayState,
  type TasbihPreset,
} from "./tasbih";

const DAY = "2026-10-05";
const NEXT_DAY = "2026-10-06";
const SUBHANALLAH = getTasbihPreset("subhanallah")!;

function tapTimes(state: TasbihDayState, preset: TasbihPreset, times: number, day = DAY) {
  let current = state;
  let xp = 0;
  for (let i = 0; i < times; i += 1) {
    const result = applyTap(current, day, preset);
    current = result.state;
    xp += result.xpEarned;
  }
  return { state: current, xp };
}

describe("preset dzikir", () => {
  it("semua preset punya teks Arab non-kosong, goal > 0, dan label unik", () => {
    const labels = new Set<string>();
    for (const preset of TASBIH_PRESETS) {
      expect(preset.arabic.length).toBeGreaterThan(0);
      expect(preset.goal).toBeGreaterThan(0);
      expect(labels.has(preset.labelKey)).toBe(false);
      labels.add(preset.labelKey);
    }
  });

  it("Tasbih Fatimah ada apa adanya: Subhanallah 33, Alhamdulillah 33, Allahu Akbar 34", () => {
    expect(getTasbihPreset("subhanallah")?.goal).toBe(33);
    expect(getTasbihPreset("alhamdulillah")?.goal).toBe(33);
    expect(getTasbihPreset("allahuakbar")?.goal).toBe(34);
  });
});

describe("roll harian", () => {
  it("hari sama → state apa adanya (idempoten)", () => {
    const state = initialTasbihDay(DAY);
    expect(rollTasbihDay(state, DAY)).toBe(state);
  });

  it("ganti hari → hitungan nol, target dibawa", () => {
    const { state } = tapTimes(initialTasbihDay(DAY, 300), SUBHANALLAH, 5);
    const rolled = rollTasbihDay(state, NEXT_DAY);
    expect(tasbihTotal(rolled)).toBe(0);
    expect(rolled.target).toBe(300);
    expect(rolled.targetPaid).toBe(false);
    expect(rolled.paidPresetIds).toEqual([]);
  });
});

describe("hadiah putaran preset", () => {
  it("putaran selesai → +XP sekali; putaran kedua hari itu tidak dibayar lagi", () => {
    const first = tapTimes(initialTasbihDay(DAY, 10000), SUBHANALLAH, 33);
    expect(first.xp).toBe(TASBIH_XP_PER_PRESET);
    const second = tapTimes(first.state, SUBHANALLAH, 33);
    // Putaran kedua tidak boleh jadi ladang XP: hadiahnya dibatasi per hari.
    expect(second.xp).toBe(0);
    expect(second.state.paidPresetIds).toEqual(["subhanallah"]);
  });

  it("preset berbeda dibayar terpisah", () => {
    let state = initialTasbihDay(DAY, 10000);
    let xp = 0;
    for (const preset of TASBIH_PRESETS) {
      const result = tapTimes(state, preset, preset.goal);
      state = result.state;
      xp += result.xp;
    }
    expect(xp).toBe(TASBIH_PRESETS.length * TASBIH_XP_PER_PRESET);
    expect(state.paidPresetIds).toHaveLength(TASBIH_PRESETS.length);
  });

  it("progres putaran mengikuti kelipatan goal", () => {
    const { state } = tapTimes(initialTasbihDay(DAY, 10000), SUBHANALLAH, 35);
    expect(presetRoundProgress(state, SUBHANALLAH)).toBe(2);
    expect(state.counts.subhanallah).toBe(35);
  });
});

describe("target harian", () => {
  it("total mencapai target → bonus + targetPaid sekali saja", () => {
    const first = tapTimes(initialTasbihDay(DAY, 3), SUBHANALLAH, 3);
    expect(first.xp).toBe(TASBIH_XP_TARGET); // belum sampai putaran 33, jadi hanya bonus target
    expect(first.state.targetPaid).toBe(true);
    const more = tapTimes(first.state, SUBHANALLAH, 2);
    expect(more.xp).toBe(0);
  });

  it("tap terakhir yang melewati target mendapat bonus + putaran sekaligus", () => {
    // goal 33 < target 33: tap ke-33 menyelesaikan putaran DAN target.
    const { xp } = tapTimes(initialTasbihDay(DAY, 33), SUBHANALLAH, 33);
    expect(xp).toBe(TASBIH_XP_PER_PRESET + TASBIH_XP_TARGET);
  });

  it("ganti target TIDAK menghapus hitungan hari ini, hanya di-clamp", () => {
    const { state } = tapTimes(initialTasbihDay(DAY, 100), SUBHANALLAH, 5);
    const changed = withTarget(state, 300);
    expect(changed.target).toBe(300);
    expect(changed.counts.subhanallah).toBe(5);
    expect(tasbihTotal(changed)).toBe(5);
    expect(withTarget(state, 0).target).toBe(1);
  });

  it("target di-clamp ke rentang wajar", () => {
    expect(initialTasbihDay(DAY, -5).target).toBe(1);
    expect(initialTasbihDay(DAY, 999999).target).toBe(10000);
    expect(initialTasbihDay(DAY, Number.NaN).target).toBe(TASBIH_DEFAULT_TARGET);
  });

  it("total harian dijumlahkan dari semua preset", () => {
    let state = initialTasbihDay(DAY, 10000);
    const salat = getTasbihPreset("salat")!;
    state = tapTimes(state, SUBHANALLAH, 4).state;
    state = tapTimes(state, salat, 6).state;
    expect(tasbihTotal(state)).toBe(10);
  });
});
