import { describe, expect, it } from "vitest";

import { FREEZE_MAX_GAP_DAYS, onDailyTargetReached, type StreakState } from "./streak";

const state = (overrides: Partial<StreakState> = {}): StreakState => ({
  streakCount: 0,
  lastActiveDate: null,
  freezeAvailable: true,
  freezeEnabled: true,
  ...overrides,
});

describe("onDailyTargetReached — hari sama (idempoten)", () => {
  it("target dicapai dua kali di hari sama → streak tidak dobel", () => {
    const first = onDailyTargetReached(state(), "2026-10-01");
    expect(first.streakCount).toBe(1);
    const second = onDailyTargetReached({ ...state(), streakCount: first.streakCount, lastActiveDate: first.lastActiveDate }, "2026-10-01");
    expect(second.streakCount).toBe(1);
    expect(second.freezeUsed).toBe(false);
  });

  it("lesson kedua hari sama tidak mengubah streak", () => {
    const active = onDailyTargetReached(state({ streakCount: 7, lastActiveDate: "2026-10-01" }), "2026-10-01");
    expect(active.streakCount).toBe(7);
  });
});

describe("onDailyTargetReached — lintas midnight WIB", () => {
  it("hari berurutan → streak +1", () => {
    const next = onDailyTargetReached(state({ streakCount: 3, lastActiveDate: "2026-10-01" }), "2026-10-02");
    expect(next.streakCount).toBe(4);
  });

  it("bolong satu hari tanpa freeze (setting off) → reset ke 1", () => {
    const next = onDailyTargetReached(
      state({ streakCount: 5, lastActiveDate: "2026-10-01", freezeEnabled: false }),
      "2026-10-03",
    );
    expect(next.streakCount).toBe(1);
    expect(next.freezeUsed).toBe(false);
  });

  it("bolong satu hari dengan freeze tersedia → freeze menambal (bukan reset)", () => {
    const next = onDailyTargetReached(state({ streakCount: 5, lastActiveDate: "2026-10-01" }), "2026-10-03");
    expect(next.streakCount).toBe(6);
    expect(next.freezeUsed).toBe(true);
  });

  it("bolong ≥ 2 hari → reset walau freeze on & tersedia", () => {
    const next = onDailyTargetReached(state({ streakCount: 5, lastActiveDate: "2026-10-01" }), "2026-10-04");
    expect(next.streakCount).toBe(1);
    expect(next.freezeUsed).toBe(false);
  });
});

describe("onDailyTargetReached — Streak Freeze", () => {
  it("bolong tepat 1 hari, freeze on & tersedia → menambal, streak lanjut, freeze terpakai", () => {
    const withFreeze = onDailyTargetReached(
      state({ streakCount: 5, lastActiveDate: "2026-10-01", freezeEnabled: true, freezeAvailable: true }),
      "2026-10-03",
    );
    expect(withFreeze.streakCount).toBe(6);
    expect(withFreeze.freezeUsed).toBe(true);
    expect(withFreeze.freezeAvailable).toBe(false);
  });

  it("freeze hanya menambal gap tepat 1 hari (konstanta)", () => {
    expect(FREEZE_MAX_GAP_DAYS).toBe(1);
  });

  it("freeze dimatikan user → bolong tetap reset", () => {
    const next = onDailyTargetReached(
      state({ streakCount: 5, lastActiveDate: "2026-10-01", freezeEnabled: false, freezeAvailable: true }),
      "2026-10-03",
    );
    expect(next.streakCount).toBe(1);
    expect(next.freezeUsed).toBe(false);
  });

  it("freeze sudah dipakai bulan ini → bolong reset", () => {
    const next = onDailyTargetReached(
      state({ streakCount: 5, lastActiveDate: "2026-10-01", freezeEnabled: true, freezeAvailable: false }),
      "2026-10-03",
    );
    expect(next.streakCount).toBe(1);
  });

  it("setelah freeze terpakai, hari berikutnya streak lanjut +1", () => {
    const frozen = onDailyTargetReached(
      state({ streakCount: 5, lastActiveDate: "2026-10-01", freezeEnabled: true, freezeAvailable: true }),
      "2026-10-03",
    );
    const nextDay = onDailyTargetReached(
      state({ streakCount: frozen.streakCount, lastActiveDate: frozen.lastActiveDate, freezeEnabled: true, freezeAvailable: frozen.freezeAvailable }),
      "2026-10-04",
    );
    expect(nextDay.streakCount).toBe(7);
    expect(nextDay.freezeUsed).toBe(false);
  });
});

describe("onDailyTargetReached — sesi pertama & kontrak zona waktu", () => {
  it("user baru → streak 1, tanpa freeze", () => {
    const first = onDailyTargetReached(state(), "2026-10-01");
    expect(first).toEqual({ streakCount: 1, lastActiveDate: "2026-10-01", freezeAvailable: true, freezeUsed: false });
  });

  it("freezeEnabled default tidak mengubah kasus tanpa bolong", () => {
    const off = onDailyTargetReached(state({ streakCount: 2, lastActiveDate: "2026-10-01", freezeEnabled: false }), "2026-10-02");
    expect(off.streakCount).toBe(3);
    expect(off.freezeUsed).toBe(false);
  });
});
