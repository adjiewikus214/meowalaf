/**
 * Test features/gamification/achievements — 6 achievement v1 (PRD § 5.5):
 * threshold per definisi, evaluasi unlock-once, urutan stabil. Pure — tanpa
 * store/React (ARCHITECTURE.md § 8).
 */
import { describe, expect, it } from "vitest";

import {
  ACHIEVEMENTS,
  achievementBonusReason,
  achievementProgress,
  achievementValue,
  achievementXpReward,
  evaluateAchievements,
  formatAchievementXp,
  getAchievement,
  isAchievementUnlocked,
  totalAchievementXp,
  type AchievementStats,
} from "./achievements";

const ZERO: AchievementStats = {
  lessonsCompleted: 0,
  streakCount: 0,
  openedSurahCount: 0,
  correctT4: 0,
  perfectLessons: 0,
  dzikirTotal: 0,
};

describe("ACHIEVEMENTS (definisi PRD § 5.5)", () => {
  it("8 achievement: 6 v1 PRD dulu (urutan tetap), lalu 2 dzikir", () => {
    expect(ACHIEVEMENTS.map((def) => def.id)).toEqual([
      "first-step",
      "starter-streak",
      "week-warrior",
      "juz30-explorer",
      "sharp-ear",
      "perfect",
      "dzikir-starter",
      "dzikir-marathon",
    ]);
    expect(new Set(ACHIEVEMENTS.map((def) => def.id)).size).toBe(8);
    for (const def of ACHIEVEMENTS) {
      expect(def.title.length).toBeGreaterThan(0);
      expect(def.descriptionKey.length).toBeGreaterThan(0);
      expect(def.emoji.length).toBeGreaterThan(0);
      expect(def.goal).toBeGreaterThanOrEqual(1);
    }
  });

  it("threshold sesuai PRD", () => {
    expect(getAchievement("first-step").goal).toBe(1);
    expect(getAchievement("starter-streak").goal).toBe(3);
    expect(getAchievement("week-warrior").goal).toBe(7);
    expect(getAchievement("juz30-explorer").goal).toBe(5);
    expect(getAchievement("sharp-ear").goal).toBe(10);
    expect(getAchievement("perfect").goal).toBe(1);
    expect(getAchievement("dzikir-starter").goal).toBe(33);
    expect(getAchievement("dzikir-marathon").goal).toBe(1000);
  });

  it("achievement dzikir memakai statistik dzikirTotal, bukan streak/lesson", () => {
    for (const id of ["dzikir-starter", "dzikir-marathon"] as const) {
      expect(getAchievement(id).stat).toBe("dzikirTotal");
    }
    const dzikir = { ...ZERO, dzikirTotal: 33 };
    expect(evaluateAchievements(dzikir, [])).toEqual(["dzikir-starter"]);
    expect(evaluateAchievements({ ...ZERO, dzikirTotal: 32 }, [])).toEqual([]);
    expect(evaluateAchievements({ ...ZERO, dzikirTotal: 1000 }, [])).toEqual([
      "dzikir-starter",
      "dzikir-marathon",
    ]);
    // Unlock-once: yang sudah terbuka tidak dibayar ulang walau statistiknya naik.
    expect(evaluateAchievements({ ...ZERO, dzikirTotal: 5000 }, ["dzikir-starter", "dzikir-marathon"])).toEqual([]);
  });

  it("id tak dikenal → throw (fail-fast)", () => {
    expect(() => getAchievement("nope" as never)).toThrow();
  });
});

describe("achievementValue / isAchievementUnlocked", () => {
  it("nilai non-negatif; unlock saat capai goal, belum sebelumnya", () => {
    const def = getAchievement("juz30-explorer");
    expect(achievementValue({ ...ZERO, openedSurahCount: -3 }, def)).toBe(0);
    expect(isAchievementUnlocked({ ...ZERO, openedSurahCount: 4 }, def)).toBe(false);
    expect(isAchievementUnlocked({ ...ZERO, openedSurahCount: 5 }, def)).toBe(true);
    expect(isAchievementUnlocked({ ...ZERO, openedSurahCount: 9 }, def)).toBe(true); // sekali lewat, tetap
  });
});

describe("evaluateAchievements", () => {
  it("statistik nol → tidak ada yang terbuka", () => {
    expect(evaluateAchievements(ZERO, [])).toEqual([]);
  });

  it("lesson pertama → First Step saja", () => {
    const fresh = evaluateAchievements({ ...ZERO, lessonsCompleted: 1 }, []);
    expect(fresh).toEqual(["first-step"]);
  });

  it("streak 3 → Starter Streak (belum Week Warrior); streak 7 → keduanya", () => {
    expect(evaluateAchievements({ ...ZERO, streakCount: 3 }, [])).toEqual(["starter-streak"]);
    expect(evaluateAchievements({ ...ZERO, streakCount: 7 }, [])).toEqual([
      "starter-streak",
      "week-warrior",
    ]);
  });

  it("T4 benar: 9 belum, 10 → Sharp Ear", () => {
    expect(evaluateAchievements({ ...ZERO, correctT4: 9 }, [])).toEqual([]);
    expect(evaluateAchievements({ ...ZERO, correctT4: 10 }, [])).toEqual(["sharp-ear"]);
  });

  it("lesson perfect → Perfect; surat terbuka 5 → Juz 30 Explorer", () => {
    expect(evaluateAchievements({ ...ZERO, perfectLessons: 1 }, [])).toEqual(["perfect"]);
    expect(evaluateAchievements({ ...ZERO, openedSurahCount: 5 }, [])).toEqual(["juz30-explorer"]);
  });

  it("unlock-once: yang sudah ada di `unlocked` tidak dikembalikan lagi (AC PRD § 5.5)", () => {
    const stats: AchievementStats = { ...ZERO, lessonsCompleted: 2, streakCount: 7 };
    const first = evaluateAchievements(stats, []);
    expect(first).toEqual(["first-step", "starter-streak", "week-warrior"]);
    expect(evaluateAchievements(stats, first)).toEqual([]);
  });

  it("gabungan: hanya yang belum terbuka yang dikembalikan, urut definisi", () => {
    const stats: AchievementStats = {
      lessonsCompleted: 1,
      streakCount: 7,
      openedSurahCount: 5,
      correctT4: 10,
      perfectLessons: 1,
      dzikirTotal: 0,
    };
    expect(evaluateAchievements(stats, [])).toEqual([
      "first-step",
      "starter-streak",
      "week-warrior",
      "juz30-explorer",
      "sharp-ear",
      "perfect",
    ]);
    expect(evaluateAchievements(stats, ["first-step", "week-warrior"])).toEqual([
      "starter-streak",
      "juz30-explorer",
      "sharp-ear",
      "perfect",
    ]);
  });
});

describe("achievementProgress (baris tampilan di Profil)", () => {
  const def = getAchievement("starter-streak"); // goal 3

  it("fraction mengikuti nilai/goal dan ter-clamp di 1", () => {
    expect(achievementProgress({ ...ZERO, streakCount: 0 }, def).fraction).toBe(0);
    expect(achievementProgress({ ...ZERO, streakCount: 1 }, def).fraction).toBeCloseTo(1 / 3);
    expect(achievementProgress({ ...ZERO, streakCount: 2 }, def).fraction).toBeCloseTo(2 / 3);
    expect(achievementProgress({ ...ZERO, streakCount: 9 }, def).fraction).toBe(1);
  });

  it("terbuka tepat saat nilai mencapai goal", () => {
    expect(achievementProgress({ ...ZERO, streakCount: 2 }, def).unlocked).toBe(false);
    expect(achievementProgress({ ...ZERO, streakCount: 3 }, def).unlocked).toBe(true);
  });

  it("nilai negatif di-clamp ke 0 (tidak jadi fraction negatif)", () => {
    const progress = achievementProgress({ ...ZERO, streakCount: -5 }, def);
    expect(progress.value).toBe(0);
    expect(progress.fraction).toBe(0);
  });

  it("semua achievement fresh: belum ada yang terbuka & fraction 0", () => {
    for (const def2 of ACHIEVEMENTS) {
      const progress = achievementProgress(ZERO, def2);
      expect(progress.unlocked).toBe(false);
      expect(progress.fraction).toBe(0);
      expect(progress.goal).toBeGreaterThanOrEqual(1);
    }
  });

  it("konsisten dengan isAchievementUnlocked (satu aturan, dua pemanggil)", () => {
    const stats: AchievementStats = {
      lessonsCompleted: 4,
      streakCount: 7,
      openedSurahCount: 5,
      correctT4: 10,
      perfectLessons: 2,
      dzikirTotal: 0,
    };
    for (const def2 of ACHIEVEMENTS) {
      expect(achievementProgress(stats, def2).unlocked).toBe(isAchievementUnlocked(stats, def2));
    }
  });
});

describe("hadiah XP achievement (xp_ledger)", () => {
  it("setiap achievement punya hadiah XP bulat & positif", () => {
    for (const def of ACHIEVEMENTS) {
      expect(Number.isInteger(def.xp)).toBe(true);
      expect(def.xp).toBeGreaterThan(0);
    }
  });

  it("achievement yang lebih berat nilainya tidak lebih kecil dari yang ringan", () => {
    // Week Warrior (7 hari streak) harus lebih mahal dari Starter Streak (3 hari).
    expect(getAchievement("week-warrior").xp).toBeGreaterThan(getAchievement("starter-streak").xp);
    // Dan achievement termurah tetap >= hadiah quest harian.
    const cheapest = Math.min(...ACHIEVEMENTS.map((def) => def.xp));
    expect(cheapest).toBeGreaterThanOrEqual(5);
  });

  it("achievementXpReward clamp & trunc (definisi rusak tidak boleh bikin XP negatif)", () => {
    expect(achievementXpReward({ ...getAchievement("perfect"), xp: 15.9 })).toBe(15);
    expect(achievementXpReward({ ...getAchievement("perfect"), xp: -99 })).toBe(0);
  });

  it("totalAchievementXp menjumlahkan beberapa unlock sekaligus", () => {
    expect(totalAchievementXp([])).toBe(0);
    // Lesson pertama sempurna → first-step (10) + perfect (15).
    expect(totalAchievementXp(["first-step", "perfect"])).toBe(25);
    expect(totalAchievementXp(ACHIEVEMENTS.map((def) => def.id))).toBe(
      ACHIEVEMENTS.reduce((sum, def) => sum + def.xp, 0),
    );
  });

  it("achievementBonusReason per-achievement supaya asal XP bisa ditelusuri", () => {
    expect(achievementBonusReason("sharp-ear")).toBe("achievement:sharp-ear");
    const reasons = ACHIEVEMENTS.map((def) => achievementBonusReason(def.id));
    expect(new Set(reasons).size).toBe(reasons.length);
  });

  it("formatAchievementXp untuk toast & daftar: '+25 XP'", () => {
    expect(formatAchievementXp("starter-streak")).toBe("+25 XP");
    expect(formatAchievementXp("first-step")).toBe("+10 XP");
  });

  it("formatAchievementXp tidak bisa bocor 'XP' ganda ke toast yang sudah berlabel", () => {
    for (const def of ACHIEVEMENTS) {
      expect(formatAchievementXp(def.id)).toMatch(/^\+\d+ XP$/);
    }
  });
});
