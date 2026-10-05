/**
 * Test core/progress/weekly — grafik tren 7 hari dari lesson_log (ARCHITECTURE § 8
 * lapisan PURE). Fokus: jendela selalu 7 hari berurutan, hari kosong tetap dapat
 * ember, akurasi null ≠ 0%, dan lesson di luar jendela tidak ikut.
 */
import { describe, expect, it } from "vitest";

import type { LessonRecord, RepoLessonEvent } from "../db/progress-repo";
import { weekdayShort } from "../i18n";

import { WEEKLY_DAYS, computeWeeklyTrend, emptyWeeklyTrend } from "./weekly";

/** Sesi sintetis: `correct` benar, `wrong` salah, XP = xpEarned. */
function makeLesson(
  day: string,
  { correct = 1, wrong = 0, xpEarned = 10, suffix = "a" } = {},
): LessonRecord {
  const events: RepoLessonEvent[] = [];
  for (let i = 0; i < correct; i += 1) {
    events.push({ type: "ANSWER_CORRECT", questionId: `q${i}`, kind: "T1", withHint: false, isRetry: false });
  }
  for (let i = 0; i < wrong; i += 1) {
    events.push({ type: "ANSWER_WRONG", questionId: `w${i}`, kind: "T2", isRetry: false });
  }
  events.push({ type: "SESSION_COMPLETED", surahId: 1, unitIndex: 0 });
  return {
    id: `lesson-${day}-${suffix}`,
    day,
    surahId: 1,
    unitIndex: 0,
    xpEarned,
    accuracy: correct + wrong === 0 ? 0 : correct / (correct + wrong),
    perfect: wrong === 0,
    events,
    completedAt: `${day}T02:00:00.000Z`,
  };
}

const TODAY = "2026-10-03"; // hari Sabtu

describe("computeWeeklyTrend", () => {
  it("tepat 7 titik, urut lama → baru, berakhir di hari anchor", () => {
    const trend = computeWeeklyTrend([], TODAY);
    expect(trend.points).toHaveLength(WEEKLY_DAYS);
    expect(trend.points.map((p) => p.day)).toEqual([
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
  });

  it("tanpa lesson: semua nol dan rata-rata akurasi null (bukan 0%)", () => {
    const trend = computeWeeklyTrend([], TODAY);
    for (const point of trend.points) {
      expect(point.xp).toBe(0);
      expect(point.sessions).toBe(0);
      expect(point.accuracy).toBeNull();
    }
    expect(trend.totalXp).toBe(0);
    expect(trend.activeDays).toBe(0);
    expect(trend.averageAccuracy).toBeNull();
  });

  it("mengelompokkan per hari: XP, sesi, benar/salah, akurasi", () => {
    const trend = computeWeeklyTrend(
      [
        makeLesson("2026-10-03", { correct: 4, wrong: 0, xpEarned: 25 }),
        makeLesson("2026-10-03", { correct: 2, wrong: 2, xpEarned: 10, suffix: "b" }),
        makeLesson("2026-10-01", { correct: 1, wrong: 1, xpEarned: 8, suffix: "c" }),
      ],
      TODAY,
    );
    const today = trend.points[6];
    expect(today?.sessions).toBe(2);
    expect(today?.xp).toBe(35);
    expect(today?.correctAnswers).toBe(6);
    expect(today?.wrongAnswers).toBe(2);
    expect(today?.accuracy).toBeCloseTo(0.75);

    expect(trend.points[4]?.sessions).toBe(1);
    expect(trend.points[4]?.accuracy).toBeCloseTo(0.5);
    expect(trend.totalXp).toBe(43);
    expect(trend.activeDays).toBe(2);
    // rata-rata harian: (0.75 + 0.5) / 2 — bukan digabung per jawaban
    expect(trend.averageAccuracy).toBeCloseTo(0.625);
  });

  it("hari tanpa lesson: akurasi null, bukan 0 (UI tidak boleh salah baca)", () => {
    const trend = computeWeeklyTrend([makeLesson(TODAY)], TODAY);
    const kosong = trend.points[0];
    expect(kosong?.sessions).toBe(0);
    expect(kosong?.accuracy).toBeNull();
    // rata-rata HANYA menghitung hari yang ada jawabannya
    expect(trend.averageAccuracy).toBe(1);
  });

  it("lesson di luar jendela 7 hari diabaikan", () => {
    const trend = computeWeeklyTrend(
      [makeLesson("2026-09-01", { xpEarned: 999, suffix: "lama" }), makeLesson(TODAY, { xpEarned: 25 })],
      TODAY,
    );
    expect(trend.totalXp).toBe(25);
    expect(trend.points.some((p) => p.xp === 999)).toBe(false);
  });

  it("batas jendela inklusif: tepat 7 hari lalu, dan hariANCHOR ikut", () => {
    const trend = computeWeeklyTrend(
      [
        makeLesson("2026-09-27", { xpEarned: 1, suffix: "tepi" }), // 7 hari lalu
        makeLesson("2026-09-26", { xpEarned: 100, suffix: "luar" }), // 8 hari lalu
      ],
      TODAY,
    );
    expect(trend.points[0]?.xp).toBe(1);
    expect(trend.totalXp).toBe(1);
  });

  it("melintasi batas bulan/tahun tetap benar (arithmetic UTC, bukan zona lokal)", () => {
    const trend = computeWeeklyTrend([], "2026-03-01");
    expect(trend.points.map((p) => p.day)).toEqual([
      "2026-02-23",
      "2026-02-24",
      "2026-02-25",
      "2026-02-26",
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
    ]);
  });

  it("hari anchor rusak → tidak crash, titik tetap 7", () => {
    const trend = computeWeeklyTrend([], "bukan-tanggal");
    expect(trend.points).toHaveLength(WEEKLY_DAYS);
  });

  it("percobaan ulang ikut dihitung sebagai jawaban (konsisten dgn stats.ts)", () => {
    const base = makeLesson(TODAY, { correct: 1, xpEarned: 5 });
    const denganRetry: LessonRecord = {
      ...base,
      events: [
        ...base.events,
        { type: "ANSWER_CORRECT", questionId: "q0", kind: "T1", withHint: false, isRetry: true },
      ],
    };
    const trend = computeWeeklyTrend([denganRetry], TODAY);
    expect(trend.points[6]?.correctAnswers).toBe(2);
    expect(trend.points[6]?.accuracy).toBe(1);
  });
});

describe("weekdayShort", () => {
  it("label 3 huruf Indonesia, index = getUTCDay", () => {
    expect(weekdayShort("id", "2026-10-03")).toBe("Sab"); // Sabtu
    expect(weekdayShort("id", "2026-10-04")).toBe("Min"); // Minggu
    expect(weekdayShort("id", "2026-10-05")).toBe("Sen"); // Senin
  });

  it("label ikut bahasa saat locale English", () => {
    expect(weekdayShort("en", "2026-10-03")).toBe("Sat");
    expect(weekdayShort("en", "2026-10-05")).toBe("Mon");
  });

  it("input rusak → string kosong, bukan crash", () => {
    expect(weekdayShort("id", "nope")).toBe("");
  });
});

describe("emptyWeeklyTrend", () => {
  it("tanpa titik (sebelum ada sesi) & nol semua", () => {
    const trend = emptyWeeklyTrend();
    expect(trend.points).toEqual([]);
    expect(trend.totalXp).toBe(0);
    expect(trend.activeDays).toBe(0);
    expect(trend.averageAccuracy).toBeNull();
  });
});