/**
 * Test features/gamification/quests — generator deterministik & evaluasi quest
 * harian (AC PRD § 5.5: 3 quest sama per user + tanggal, berganti setelah
 * tengah malam WIB, hadiah +5 XP; varian non-glos per ADR-005). Pure — tanpa
 * store/React (ARCHITECTURE.md § 8: engine diuji unit).
 */
import { describe, expect, it } from "vitest";

import {
  QUEST_XP_REWARD,
  QUESTS_PER_DAY,
  applyDzikir,
  applyLessonCompleted,
  applySurahOpened,
  initialQuestDay,
  isQuestComplete,
  newlyCompletedQuests,
  questDayStats,
  questProgress,
  questsForDay,
  rollQuestDay,
  type DailyQuest,
  type QuestDayStats,
} from "./quests";

const EMPTY: QuestDayStats = {
  lessonsCompleted: 0,
  correctAnswers: 0,
  surahsOpened: 0,
  perfectLessons: 0,
  dzikirCount: 0,
};

/**
 * Hari pertama (dalam 60 hari sejak 5 Okt 2026) yang komposisi questnya memuat
 * kategori dzikir. Dipakai test yang butuh quest dzikir tanpa mengunci ke satu
 * tanggal: 3 dari 5 kategori dipilih per hari, jadi tidak semua hari punya.
 */
function dayWithDzikir(): string {
  for (let offset = 0; offset < 60; offset++) {
    const day = new Date(Date.UTC(2026, 9, 5 + offset)).toISOString().slice(0, 10);
    if (questsForDay(day).some((q) => q.category === "dzikir")) return day;
  }
  throw new Error("tidak ada quest dzikir dalam 60 hari — pool rusak?");
}

/** Cari quest by id — gagal keras bila generator berubah (golden lock). */
function quest(day: string, id: string): DailyQuest {
  const found = questsForDay(day).find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`quest ${id} tidak ada di ${day}`);
  return found;
}

describe("questsForDay (generator deterministik)", () => {
  it("tepat 3 quest; kategori & id unik; goal ≥ 1; hadiah +5 XP", () => {
    for (const day of ["2026-10-05", "2026-12-25", "2027-01-01"]) {
      const quests = questsForDay(day);
      expect(quests).toHaveLength(QUESTS_PER_DAY);
      expect(new Set(quests.map((q) => q.category)).size).toBe(QUESTS_PER_DAY);
      expect(new Set(quests.map((q) => q.id)).size).toBe(QUESTS_PER_DAY);
      for (const item of quests) {
        expect(item.goal).toBeGreaterThanOrEqual(1);
        expect(item.xpReward).toBe(QUEST_XP_REWARD);
        expect(item.titleKey.length).toBeGreaterThan(0);
      }
    }
  });

  it("hari + seed sama → daftar identik (AC: sama untuk user & tanggal sama)", () => {
    const first = questsForDay("2026-10-05", "local");
    const second = questsForDay("2026-10-05", "local");
    expect(second).toEqual(first);
    // Golden lock — kunci algoritme terhadap regresi tak sengaja. Nilai ini
    // diperbarui sekali saat kategori "dzikir" masuk pool (5 Okt 2026): 10-05
    // kebetulan tidak berubah, 10-06 berubah karena kategorinya ikut diundi.
    expect(first.map((q) => q.id)).toEqual(["surah-1", "correct-12", "lesson-1"]);
    expect(questsForDay("2026-10-06", "local").map((q) => q.id)).toEqual([
      "lesson-1",
      "correct-25",
      "dzikir-100",
    ]);
  });

  it("tanggal berbeda atau seed berbeda → beda komposisi", () => {
    expect(questsForDay("2026-10-06").map((q) => q.id)).not.toEqual(
      questsForDay("2026-10-05").map((q) => q.id),
    );
    expect(questsForDay("2026-10-05", "other-user").map((q) => q.id)).not.toEqual(
      questsForDay("2026-10-05").map((q) => q.id),
    );
  });

  it("tidak pernah memuat quest glos (ditunda — ADR-005)", () => {
    const titles: string[] = [];
    for (let offset = 0; offset < 90; offset++) {
      const day = new Date(Date.UTC(2026, 0, 1 + offset)).toISOString().slice(0, 10);
      titles.push(...questsForDay(day).map((q) => q.titleKey.toLowerCase()));
    }
    expect(titles.some((title) => title.includes("arti kata") || title.includes("glos"))).toBe(false);
  });
});

describe("evaluasi progres quest", () => {
  it("nilai per kategori + clamp tampilan ke goal", () => {
    const surahQuest = quest("2026-10-05", "surah-1"); // goal 1
    const correctQuest = quest("2026-10-05", "correct-12"); // goal 12
    const stats: QuestDayStats = {
      lessonsCompleted: 0,
      correctAnswers: 99,
      surahsOpened: 1,
      perfectLessons: 0,
      dzikirCount: 0,
    };
    expect(isQuestComplete(surahQuest, stats)).toBe(true);
    expect(questProgress(surahQuest, stats)).toBe(1); // clamp
    expect(isQuestComplete(correctQuest, stats)).toBe(true);
    expect(questProgress(correctQuest, stats)).toBe(12); // clamp ke goal
    expect(questProgress(correctQuest, EMPTY)).toBe(0);
    expect(isQuestComplete(correctQuest, EMPTY)).toBe(false);
  });

  it("newlyCompletedQuests: hanya yang target tercapai & belum tercatat", () => {
    const quests = questsForDay("2026-10-05");
    const half: QuestDayStats = { ...EMPTY, surahsOpened: 1, lessonsCompleted: 1 };
    expect(newlyCompletedQuests([], quests, half).map((q) => q.id)).toEqual(["surah-1", "lesson-1"]);
    expect(newlyCompletedQuests(["surah-1"], quests, half).map((q) => q.id)).toEqual(["lesson-1"]);
    expect(newlyCompletedQuests(["surah-1", "lesson-1"], quests, half)).toEqual([]);
    expect(newlyCompletedQuests([], quests, EMPTY)).toEqual([]);
  });
});

describe("state sehari (roll + apply)", () => {
  it("initialQuestDay: quest cocok dengan generator, hitungan nol", () => {
    const state = initialQuestDay("2026-10-05");
    expect(state.day).toBe("2026-10-05");
    expect(state.quests.map((q) => q.id)).toEqual(questsForDay("2026-10-05").map((q) => q.id));
    expect(state.completedIds).toEqual([]);
    expect(state.openedSurahIds).toEqual([]);
    expect(questDayStats(state)).toEqual(EMPTY);
  });

  it("rollQuestDay idempoten di hari yang sama; hari baru → reset total", () => {
    const state = initialQuestDay("2026-10-05");
    expect(rollQuestDay(state, "2026-10-05")).toBe(state);
    const dirty = {
      ...state,
      completedIds: ["surah-1"],
      openedSurahIds: [2, 3],
      lessonsCompleted: 2,
      correctAnswers: 9,
      perfectLessons: 1,
    };
    const rolled = rollQuestDay(dirty, "2026-10-06");
    expect(rolled.day).toBe("2026-10-06");
    expect(rolled.quests.map((q) => q.id)).toEqual(questsForDay("2026-10-06").map((q) => q.id));
    expect(rolled.completedIds).toEqual([]);
    expect(questDayStats(rolled)).toEqual(EMPTY);
  });

  it("applyLessonCompleted: hitung + deteksi quest selesai sekali saja", () => {
    const day = "2026-10-05"; // quest: surah-1, correct-12, lesson-1
    const first = applyLessonCompleted(initialQuestDay(day), day, { correct: 6, perfect: true });
    expect(first.state.lessonsCompleted).toBe(1);
    expect(first.state.correctAnswers).toBe(6);
    expect(first.state.perfectLessons).toBe(1);
    expect(first.completed.map((q) => q.id)).toEqual(["lesson-1"]);

    // Kedua kalinya: quest lesson sudah tercatat → tidak ada imbalan dobel.
    const second = applyLessonCompleted(first.state, day, { correct: 3, perfect: false });
    expect(second.state.lessonsCompleted).toBe(2);
    expect(second.completed).toEqual([]);
  });

  it("applyLessonCompleted lintas hari: gulir dulu, hitungan hari lama tidak terbawa", () => {
    const yesterday = { ...initialQuestDay("2026-10-05"), lessonsCompleted: 2, correctAnswers: 10 };
    const result = applyLessonCompleted(yesterday, "2026-10-06", { correct: 1, perfect: false });
    expect(result.state.day).toBe("2026-10-06");
    expect(result.state.lessonsCompleted).toBe(1); // bukan 3
    expect(result.state.correctAnswers).toBe(1); // bukan 11
  });

  it("applyDzikir: total naik memicu quest dzikir, nilai lebih rendah diabaikan", () => {
    // Quest hari itu hanya berisi 3 dari 5 kategori, jadi cari hari yang BENAR
    // memuat quest dzikir — bukan mengasumsikan komposisi satu tanggal.
    const day = dayWithDzikir();
    const dzikirQuest = questsForDay(day).find((q) => q.category === "dzikir")!;
    const first = applyDzikir(initialQuestDay(day), day, dzikirQuest.goal);
    expect(first.state.dzikirCount).toBe(dzikirQuest.goal);
    expect(first.completed.map((q) => q.id)).toEqual([dzikirQuest.id]);

    // Reset hitungan tasbih (user menekan reset) tidak boleh membatalkan quest.
    const lower = applyDzikir(first.state, day, 0);
    expect(lower.state.dzikirCount).toBe(dzikirQuest.goal);
    expect(lower.completed).toEqual([]);

    // Naik lagi melewati goal → tidak ada hadiah dobel.
    expect(applyDzikir(lower.state, day, dzikirQuest.goal + 7).completed).toEqual([]);
  });

  it("applyDzikir lintas hari: hitungan hari lama tidak terbawa", () => {
    const yesterday = { ...initialQuestDay("2026-10-05"), dzikirCount: 500 };
    const result = applyDzikir(yesterday, "2026-10-06", 3);
    expect(result.state.day).toBe("2026-10-06");
    expect(result.state.dzikirCount).toBe(3);
  });

  it("applySurahOpened: dedup per hari + quest surah terdeteksi", () => {
    const day = "2026-10-05"; // surah-1 goal 1
    const first = applySurahOpened(initialQuestDay(day), day, 112);
    expect(first.state.openedSurahIds).toEqual([112]);
    expect(first.completed.map((q) => q.id)).toEqual(["surah-1"]);

    const dup = applySurahOpened(first.state, day, 112);
    expect(dup.state.openedSurahIds).toEqual([112]);
    expect(dup.completed).toEqual([]);

    const other = applySurahOpened(dup.state, day, 2);
    expect(other.state.openedSurahIds).toEqual([112, 2]);
    expect(other.completed).toEqual([]); // surah-1 sudah tercatat selesai
  });
});
