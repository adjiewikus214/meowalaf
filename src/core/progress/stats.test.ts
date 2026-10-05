/**
 * Test core/progress/stats — rekap statistik profil dari lesson_log (PRD § 5.6).
 * PURE: tanpa repo, tanpa jam device — sesi terakhir ditentukan dari completedAt.
 */
import { describe, expect, it } from "vitest";

import type { LessonRecord, RepoLessonEvent } from "../db/progress-repo";
import { computeLessonStats, emptyLessonStats } from "./stats";

let seq = 0;

function makeLesson(overrides: Partial<LessonRecord> = {}): LessonRecord {
  seq += 1;
  const events: readonly RepoLessonEvent[] = overrides.events ?? [
    { type: "ANSWER_CORRECT", questionId: `q${seq}-1`, kind: "T1", withHint: false, isRetry: false },
    { type: "SESSION_COMPLETED", surahId: 1, unitIndex: 0 },
  ];
  return {
    id: `lesson-${seq}`,
    day: "2026-10-03",
    surahId: 1,
    unitIndex: 0,
    xpEarned: 10,
    accuracy: 1,
    perfect: false,
    events,
    completedAt: `2026-10-03T0${seq % 10}:00:00.000Z`,
    ...overrides,
  };
}

describe("computeLessonStats (pure)", () => {
  it("lesson_log kosong → rekap nol tanpa NaN, lastSession null", () => {
    const stats = computeLessonStats([]);
    expect(stats).toEqual(emptyLessonStats());
    expect(stats.accuracy).toBe(0);
    expect(stats.lastSession).toBeNull();
  });

  it("agregat lintas sesi: XP, benar/salah, akurasi tertimbang, sesi sempurna", () => {
    const a = makeLesson({
      id: "lesson-a",
      xpEarned: 20,
      perfect: false,
      events: [
        { type: "ANSWER_CORRECT", questionId: "q1", kind: "T1", withHint: false, isRetry: false },
        { type: "ANSWER_CORRECT", questionId: "q2", kind: "T2", withHint: true, isRetry: true },
        { type: "ANSWER_WRONG", questionId: "q3", kind: "T3", isRetry: false },
        { type: "SESSION_COMPLETED", surahId: 1, unitIndex: 0 },
      ],
    });
    const b = makeLesson({ id: "lesson-b", xpEarned: 10, perfect: true });
    const stats = computeLessonStats([a, b]);

    expect(stats.sessions).toBe(2);
    expect(stats.totalXp).toBe(30);
    expect(stats.correctAnswers).toBe(3);
    expect(stats.wrongAnswers).toBe(1);
    expect(stats.accuracy).toBeCloseTo(3 / 4, 10);
    expect(stats.perfectSessions).toBe(1);
  });

  it("sesi terakhir = completedAt terbesar, bukan urutan array", () => {
    const older = makeLesson({ id: "lesson-x", completedAt: "2026-10-01T10:00:00.000Z", day: "2026-10-01", surahId: 112 });
    const newer = makeLesson({ id: "lesson-y", completedAt: "2026-10-03T09:00:00.000Z", day: "2026-10-03", surahId: 2, unitIndex: 1, xpEarned: 24, accuracy: 0.75, perfect: true });
    const stats = computeLessonStats([newer, older]); // array sengaja tak berurut

    expect(stats.lastSession).not.toBeNull();
    expect(stats.lastSession).toEqual({
      day: "2026-10-03",
      completedAt: "2026-10-03T09:00:00.000Z",
      surahId: 2,
      unitIndex: 1,
      accuracy: 0.75,
      xpEarned: 24,
      perfect: true,
    });
  });

  it("sesi tanpa jawaban tercatat → akurasi 0 (guard bagi nol, bukan NaN)", () => {
    const stats = computeLessonStats([
      makeLesson({
        events: [{ type: "SESSION_COMPLETED", surahId: 1, unitIndex: 0 }],
      }),
    ]);
    expect(stats.accuracy).toBe(0);
    expect(stats.correctAnswers).toBe(0);
    expect(stats.wrongAnswers).toBe(0);
    expect(stats.sessions).toBe(1);
  });

  it("XP bonus quest dijumlahkan ke totalXp (bikin total Profil = yang dilihat di Home)", () => {
    const lessons = [makeLesson({ xpEarned: 25 })];
    expect(computeLessonStats(lessons, 10).totalXp).toBe(35);
  });

  it("hanya bonus tanpa sesi → stats tetap valid, lastSession null", () => {
    const stats = computeLessonStats([], 10);
    expect(stats.totalXp).toBe(10);
    expect(stats.sessions).toBe(0);
    expect(stats.accuracy).toBe(0);
    expect(stats.lastSession).toBeNull();
  });
});
