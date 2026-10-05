import { describe, expect, it } from "vitest";

import type { LessonEvent } from "@/features/lessons/types";

import {
  bonusXpId,
  levelForXp,
  levelProgress,
  xpForEvents,
  xpPerCorrectAnswer,
  xpToReachLevel,
  XP_LESSON_COMPLETED,
  XP_MIN_PER_CORRECT,
  XP_PERFECT_BONUS,
} from "./xp";

const correct = (withHint = false, isRetry = false): LessonEvent => ({
  type: "ANSWER_CORRECT",
  kind: "T1",
  withHint,
  isRetry,
});
const wrong: LessonEvent = { type: "ANSWER_WRONG", kind: "T1", isRetry: false };
const completed: LessonEvent = { type: "SESSION_COMPLETED", surahId: 1, unitIndex: 0 };

describe("xpPerCorrectAnswer", () => {
  it("benar polos +3, dengan hint 3−1=2, min +1", () => {
    expect(xpPerCorrectAnswer(false)).toBe(3);
    expect(xpPerCorrectAnswer(true)).toBe(2);
    expect(XP_MIN_PER_CORRECT).toBe(1);
  });
});

describe("xpForEvents", () => {
  it("satu jawaban benar = +3", () => {
    expect(xpForEvents([correct()])).toBe(3);
  });

  it("jawaban benar dengan hint = +2", () => {
    expect(xpForEvents([correct(true)])).toBe(2);
  });

  it("jawaban salah = 0 XP", () => {
    expect(xpForEvents([wrong])).toBe(0);
  });

  it("lesson selesai = +2", () => {
    expect(xpForEvents([completed])).toBe(2);
  });

  it("perfect (≥1 benar, tanpa salah) = +5 bonus", () => {
    expect(xpForEvents([correct(), correct(), completed])).toBe(3 * 2 + 2 + XP_PERFECT_BONUS);
  });

  it("satu salah membatalkan bonus perfect", () => {
    expect(xpForEvents([correct(), wrong, completed])).toBe(3 + 2);
  });

  it("retry yang benar TIDAK menambah XP di luar aturan (tetap 3 per benar)", () => {
    expect(xpForEvents([wrong, correct(false, true), completed])).toBe(3 + 2);
  });

  it("verify PRD § 5.5: 5 soal semua benar tanpa hint + selesai = 22 XP", () => {
    const events: LessonEvent[] = [correct(), correct(), correct(), correct(), correct(), completed];
    expect(xpForEvents(events)).toBe(15 + XP_PERFECT_BONUS + XP_LESSON_COMPLETED);
    expect(xpForEvents(events)).toBe(22);
  });

  it("events kosong = 0", () => {
    expect(xpForEvents([])).toBe(0);
  });
});

describe("kurva level (PRD § 5.5: 50·n·(n+1)/2)", () => {
  it("ambang level benar: 50, 150, 300, 500", () => {
    expect(xpToReachLevel(1)).toBe(50);
    expect(xpToReachLevel(2)).toBe(150);
    expect(xpToReachLevel(3)).toBe(300);
    expect(xpToReachLevel(4)).toBe(500);
  });

  it("levelForXp tepat di & di bawah ambang", () => {
    expect(levelForXp(0)).toBe(0);
    expect(levelForXp(49)).toBe(0);
    expect(levelForXp(50)).toBe(1);
    expect(levelForXp(149)).toBe(1);
    expect(levelForXp(150)).toBe(2);
    expect(levelForXp(299)).toBe(2);
    expect(levelForXp(300)).toBe(3);
  });

  it("levelProgress membagi XP dalam level berjalan", () => {
    expect(levelProgress(50)).toEqual({ level: 1, xpInLevel: 0, xpLevelSpan: 100 });
    expect(levelProgress(120)).toEqual({ level: 1, xpInLevel: 70, xpLevelSpan: 100 });
    expect(levelProgress(150)).toEqual({ level: 2, xpInLevel: 0, xpLevelSpan: 150 });
    expect(levelProgress(0)).toEqual({ level: 0, xpInLevel: 0, xpLevelSpan: 50 });
  });
});

describe("bonusXpId (id unik entri xp_ledger)", () => {
  it("dua bonus di milidetik yang sama tetap dapat id berbeda", () => {
    // Bug nyata yang ketemu saat QA web: lesson pertama sempurna membuka
    // first-step + perfect sekaligus, keduanya dibayar dalam milidetik yang
    // sama. Dengan id berbasis timestamp saja, INSERT kedua ditolak SQLite.
    const sameInstant = "2026-10-03T04:38:36.123Z";
    const ids = [1, 2, 3].map((seq) => bonusXpId(sameInstant, seq));
    expect(new Set(ids).size).toBe(3);
  });

  it("timestamp berbeda tetap jadi id berbeda walau urutnya sama", () => {
    expect(bonusXpId("2026-10-03T04:38:36.123Z", 1)).not.toBe(
      bonusXpId("2026-10-03T04:38:37.123Z", 1),
    );
  });

  it("formatnya stabil & terbaca: bonus-<iso>-<urut>", () => {
    expect(bonusXpId("2026-10-03T04:38:36.123Z", 7)).toBe("bonus-2026-10-03T04:38:36.123Z-7");
  });
});
