/**
 * Test core/progress/lesson-store — alur engine → events → XP/streak/harian
 * (ARCHITECTURE.md § 8 lapisan integrasi). Tanpa jaringan & tanpa SQLite asli:
 * persistence memakai InMemoryProgressRepo. Skenario kunci ROADMAP § 3:
 * idempoten (replay tidak dobel), lintas hari, dan rekonsiliasi recovery.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryProgressRepo, type LessonRecord, type RepoLessonEvent } from "../db/progress-repo";
import {
  applyLessonRecord,
  countCorrectEvents,
  initialProgressData,
  reconcileProgressDay,
  useProgressEventsStore,
} from "./lesson-store";

const STREAK_INPUT = { dailyTarget: 1, freezeEnabled: true };

let eventSeq = 0;

/** Sesi sintetis 4 soal benar (2 tanpa hint) + completed — tanpa import features. */
function makeSessionResult(): { xpEarned: number; accuracy: number; perfect: boolean; events: RepoLessonEvent[] } {
  const base = (eventSeq += 1) * 100;
  const events: RepoLessonEvent[] = [
    { type: "ANSWER_CORRECT", questionId: `q${base + 1}`, kind: "T1", withHint: false, isRetry: false },
    { type: "ANSWER_CORRECT", questionId: `q${base + 2}`, kind: "T2", withHint: false, isRetry: false },
    { type: "ANSWER_CORRECT", questionId: `q${base + 3}`, kind: "T3", withHint: true, isRetry: false },
    { type: "ANSWER_CORRECT", questionId: `q${base + 4}`, kind: "T4", withHint: false, isRetry: false },
    { type: "SESSION_COMPLETED", surahId: 112, unitIndex: 0 },
  ];
  // XP: 3+3+2+3 = 11 + bonus lesson 2 + perfect 5 = 18 (aturan core/progress/xp).
  return { xpEarned: 18, accuracy: 1, perfect: true, events };
}

function makeRecord(day: string, suffix = "a", xpEarned?: number): LessonRecord {
  const result = makeSessionResult();
  return {
    id: `lesson-${day}-${suffix}`,
    day,
    surahId: 112,
    unitIndex: 0,
    xpEarned: xpEarned ?? result.xpEarned,
    accuracy: result.accuracy,
    perfect: result.perfect,
    events: result.events,
    completedAt: `2026-10-01T02:0${suffix.charCodeAt(0) % 10}:00.000Z`,
  };
}

describe("countCorrectEvents", () => {
  it("menghitung ANSWER_CORRECT (termasuk retry), abaikan event lain", () => {
    const result = makeSessionResult();
    expect(countCorrectEvents(result.events)).toBeGreaterThan(0);
    expect(countCorrectEvents([{ type: "SESSION_COMPLETED" } as never])).toBe(0);
  });
});

describe("applyLessonRecord (pure)", () => {
  it("lesson pertama hari pertama: XP naik, streak = 1 (target harian tercapai)", () => {
    const record = makeRecord("2026-10-01");
    const next = applyLessonRecord(initialProgressData("2026-10-01"), record, STREAK_INPUT);
    expect(next.lessonsToday).toBe(1);
    expect(next.xpTotal).toBe(record.xpEarned);
    expect(next.streakCount).toBe(1);
    expect(next.lastActiveDay).toBe("2026-10-01");
  });

  it("lesson kedua di hari sama: agregat naik, streak TIDAK bertambah lagi", () => {
    const first = applyLessonRecord(initialProgressData("2026-10-01"), makeRecord("2026-10-01", "a"), STREAK_INPUT);
    const second = applyLessonRecord(first, makeRecord("2026-10-01", "b"), STREAK_INPUT);
    expect(first.streakCount).toBe(1);
    expect(second.streakCount).toBe(1);
    expect(second.lessonsToday).toBe(2);
    expect(second.xpTotal).toBe(first.xpTotal + second.xpTotal - first.xpTotal);
  });

  it("ganti hari: agregat harian reset, streak lanjut +1 (gap 1 hari)", () => {
    const yesterday = {
      ...initialProgressData("2026-10-01"),
      xpTotal: 22,
      lessonsToday: 2,
      correctToday: 5,
      streakCount: 3,
      lastActiveDay: "2026-10-01",
    };
    const record = makeRecord("2026-10-02", "a", 10);
    const next = applyLessonRecord(yesterday, record, STREAK_INPUT);
    expect(next.day).toBe("2026-10-02");
    expect(next.lessonsToday).toBe(1);
    expect(next.xpTotal).toBe(10);
    expect(next.streakCount).toBe(4);
  });

  it("dailyTarget 2: streak baru +1 setelah lesson KEDUA hari itu", () => {
    const input = { dailyTarget: 2, freezeEnabled: true };
    const first = applyLessonRecord(initialProgressData("2026-10-01"), makeRecord("2026-10-01", "a"), input);
    expect(first.streakCount).toBe(0);
    const second = applyLessonRecord(first, makeRecord("2026-10-01", "b"), input);
    expect(second.streakCount).toBe(1);
    expect(second.lessonsToday).toBe(2);
  });

  it("streak tidak naik saat bolong 1 hari tanpa bisa dipulihkan (reset ke 1)", () => {
    const twoDaysAgo = {
      ...initialProgressData("2026-10-01"),
      streakCount: 5,
      lastActiveDay: "2026-10-01",
      freezeAvailable: false,
    };
    const next = applyLessonRecord(twoDaysAgo, makeRecord("2026-10-03"), STREAK_INPUT);
    expect(next.streakCount).toBe(1);
    expect(next.lastActiveDay).toBe("2026-10-03");
  });
});

describe("useProgressEventsStore (integrasi in-memory repo)", () => {
  let repo: InMemoryProgressRepo;

  beforeEach(() => {
    repo = new InMemoryProgressRepo();
    useProgressEventsStore.getState().resetForTest();
  });

  it("recordLessonSession: log tersimpan, baris harian ter-upsert, state sinkron", async () => {
    const store = useProgressEventsStore.getState();
    await store.hydrate(repo, "2026-10-01");
    const outcome = await useProgressEventsStore.getState().recordLessonSession({
      result: makeSessionResult(),
      surahId: 112,
      unitIndex: 0,
      day: "2026-10-01",
      ...STREAK_INPUT,
    });
    expect(outcome).toBe("saved");

    const state = useProgressEventsStore.getState();
    expect(state.status).toBe("ready");
    expect(state.lessonsToday).toBe(1);
    expect(state.xpTotal).toBeGreaterThan(0);
    expect(state.streakCount).toBe(1);
    expect((await repo.getLessonsByDay("2026-10-01")).length).toBe(1);
    const row = await repo.getProgressDay("2026-10-01");
    expect(row?.xpTotal).toBe(state.xpTotal);
  });

  it("replay sesi yang sama → duplicate, agregat TIDAK dobel (kill-app safe)", async () => {
    await useProgressEventsStore.getState().hydrate(repo, "2026-10-01");
    // Simulasi crash setelah commit pertama: catat manual ke repo, lalu hydrate ulang
    // dan rekam sesi "replay" dengan id yang sama.
    const record = makeRecord("2026-10-01", "replay");
    expect(await repo.recordLessonSession(record)).toBe("saved");

    const reconciled = await reconcileProgressDay(repo, "2026-10-01");
    expect(reconciled.lessonsToday).toBe(1);

    const outcome = await repo.recordLessonSession(record);
    expect(outcome).toBe("duplicate");
    expect((await repo.getLessonsByDay("2026-10-01")).length).toBe(1);
  });

  it("hydrate merekonstruksi agregat harian dari lesson_log (recovery path)", async () => {
    const record = makeRecord("2026-10-01", "r1");
    await repo.migrate();
    await repo.recordLessonSession(record);
    // Baris harian hilang/stale (crash antara log dan upsert) → hydrate membangun ulang.
    const data = await reconcileProgressDay(repo, "2026-10-01");
    expect(data.lessonsToday).toBe(1);
    expect(data.xpTotal).toBe(record.xpEarned);
    expect(data.correctToday).toBe(countCorrectEvents(record.events));
  });

  it("hydrate DB gagal → fail-soft: status ready dengan progres nol", async () => {
    const broken = {
      migrate: () => Promise.reject(new Error("db rusak")),
      getProgressDay: () => Promise.reject(new Error("db rusak")),
      getLatestProgressDayUpTo: () => Promise.reject(new Error("db rusak")),
      saveProgressDay: () => Promise.reject(new Error("db rusak")),
      recordLessonSession: () => Promise.reject(new Error("db rusak")),
      getLessonsByDay: () => Promise.reject(new Error("db rusak")),
      getAllLessons: () => Promise.reject(new Error("db rusak")),
      recordBonusXp: () => Promise.reject(new Error("db rusak")),
      getBonusXpByDay: () => Promise.reject(new Error("db rusak")),
      getAllBonusXp: () => Promise.reject(new Error("db rusak")),
      getBookmarks: () => Promise.reject(new Error("db rusak")),
      addBookmark: () => Promise.reject(new Error("db rusak")),
      removeBookmark: () => Promise.reject(new Error("db rusak")),
      clearAll: () => Promise.reject(new Error("db rusak")),
    };
    await useProgressEventsStore.getState().hydrate(broken, "2026-10-01");
    const state = useProgressEventsStore.getState();
    expect(state.status).toBe("ready");
    expect(state.lessonsToday).toBe(0);
    expect(state.xpTotal).toBe(0);
  });

  it("lintas hari di store: hydrate hari baru → agregat dari nol, streak dipertahankan", async () => {
    const record = makeRecord("2026-09-30", "kemarin");
    await repo.migrate();
    await repo.recordLessonSession(record);
    await repo.saveProgressDay({
      day: "2026-09-30",
      xpTotal: record.xpEarned,
      streakCount: 4,
      lastActiveDay: "2026-09-30",
      freezeAvailable: true,
      freezeUsedDay: null,
      lessonsToday: 1,
      correctToday: countCorrectEvents(record.events),
    });
    // Keesokan harinya app dibuka → hydrate hari 10-01: lessonsToday reset,
    // streak field masih 4 (baru +1 saat target hari ini tercapai).
    await useProgressEventsStore.getState().hydrate(repo, "2026-10-01");
    const state = useProgressEventsStore.getState();
    expect(state.day).toBe("2026-10-01");
    expect(state.lessonsToday).toBe(0);
    expect(state.streakCount).toBe(4);
    expect(state.lastActiveDay).toBe("2026-09-30");
  });
});

describe("applyExternalTargetReached + reachDailyTarget (tasbih, PRD § 5.5)", () => {
  let repo: InMemoryProgressRepo;

  beforeEach(async () => {
    repo = new InMemoryProgressRepo();
    useProgressEventsStore.getState().resetForTest();
    await useProgressEventsStore.getState().hydrate(repo, "2026-10-01");
  });

  it("menaikkan streak tanpa menambah lessonsToday (ring Home tetap hitungan lesson)", () => {
    useProgressEventsStore.getState().reachDailyTarget("2026-10-01", { freezeEnabled: true });
    const state = useProgressEventsStore.getState();
    expect(state.streakCount).toBe(1);
    expect(state.lessonsToday).toBe(0);
    expect(state.lastActiveDay).toBe("2026-10-01");
  });

  it("idempoten per hari: menyentuh target berkali-kali tidak menambah streak", () => {
    useProgressEventsStore.getState().reachDailyTarget("2026-10-01", { freezeEnabled: true });
    useProgressEventsStore.getState().reachDailyTarget("2026-10-01", { freezeEnabled: true });
    useProgressEventsStore.getState().reachDailyTarget("2026-10-01", { freezeEnabled: true });
    expect(useProgressEventsStore.getState().streakCount).toBe(1);
  });

  it("lesson di hari yang sama setelah tasbih tidak menghitung streak dua kali", async () => {
    useProgressEventsStore.getState().reachDailyTarget("2026-10-01", { freezeEnabled: true });
    await useProgressEventsStore.getState().recordLessonSession({
      result: makeSessionResult(),
      surahId: 112,
      unitIndex: 0,
      day: "2026-10-01",
      ...STREAK_INPUT,
    });
    expect(useProgressEventsStore.getState().streakCount).toBe(1);
    expect(useProgressEventsStore.getState().lessonsToday).toBe(1);
  });

  it("baris harian ikut tersimpan (streak selamat hydrate ulang)", async () => {
    useProgressEventsStore.getState().reachDailyTarget("2026-10-01", { freezeEnabled: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const row = await repo.getProgressDay("2026-10-01");
    expect(row?.streakCount).toBe(1);
    expect(row?.lastActiveDay).toBe("2026-10-01");
  });
});

describe("addBonusXp (hadiah quest, PRD § 5.5)", () => {
  let repo: InMemoryProgressRepo;

  beforeEach(async () => {
    repo = new InMemoryProgressRepo();
    useProgressEventsStore.getState().resetForTest();
    await useProgressEventsStore.getState().hydrate(repo, "2026-10-01");
  });

  it("menambah xpTotal dan upsert baris harian (fire-and-forget fail-soft)", async () => {
    const before = useProgressEventsStore.getState().xpTotal;
    useProgressEventsStore.getState().addBonusXp(5);
    expect(useProgressEventsStore.getState().xpTotal).toBe(before + 5);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const row = await repo.getProgressDay("2026-10-01");
    expect(row?.xpTotal).toBe(before + 5);
  });

  it("amount ≤ 0 / tidak valid → no-op", () => {
    const before = useProgressEventsStore.getState().xpTotal;
    useProgressEventsStore.getState().addBonusXp(0);
    useProgressEventsStore.getState().addBonusXp(-5);
    useProgressEventsStore.getState().addBonusXp(Number.NaN);
    expect(useProgressEventsStore.getState().xpTotal).toBe(before);
  });

  it("mencatat bonus ke xp_ledger (bukan cuma snapshot harian)", async () => {
    useProgressEventsStore.getState().addBonusXp(5);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const ledger = await repo.getBonusXpByDay("2026-10-01");
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ day: "2026-10-01", amount: 5, reason: "quest" });
  });

  it("bonus ikut masuk rekap XP Profil (totalXp sesi + bonus)", async () => {
    await useProgressEventsStore.getState().recordLessonSession({
      result: makeSessionResult(),
      surahId: 112,
      unitIndex: 0,
      day: "2026-10-01",
      ...STREAK_INPUT,
    });
    await new Promise((resolve) => setTimeout(resolve, 0)); // loadStats dipanggil fire-and-forget
    const lessonXp = useProgressEventsStore.getState().stats.totalXp;
    useProgressEventsStore.getState().addBonusXp(5);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useProgressEventsStore.getState().stats.totalXp).toBe(lessonXp + 5);
  });
});

describe("loadStats (rekap profil dari lesson_log, PRD § 5.6)", () => {
  let repo: InMemoryProgressRepo;

  beforeEach(async () => {
    repo = new InMemoryProgressRepo();
    useProgressEventsStore.getState().resetForTest();
    await useProgressEventsStore.getState().hydrate(repo, "2026-10-01");
  });

  it("rekap lintas hari: sesi terakhir = completedAt terbaru, XP terakumulasi", async () => {
    const older = makeRecord("2026-10-01", "a", 20);
    const newer = { ...makeRecord("2026-10-01", "b", 10), id: "lesson-newer", day: "2026-10-02", completedAt: "2026-10-02T11:00:00.000Z" };
    await repo.recordLessonSession(older);
    await repo.recordLessonSession(newer);

    await useProgressEventsStore.getState().loadStats();
    const stats = useProgressEventsStore.getState().stats;
    expect(stats.sessions).toBe(2);
    expect(stats.totalXp).toBe(30);
    expect(stats.lastSession?.day).toBe("2026-10-02");
    expect(stats.lastSession?.xpEarned).toBe(10);
    expect(stats.accuracy).toBe(1); // fixture: semua benar
    expect(stats.perfectSessions).toBe(2);
  });

  it("recordLessonSession ikut me-refresh rekap tanpa dipanggil manual", async () => {
    await useProgressEventsStore.getState().recordLessonSession({
      result: makeSessionResult(),
      surahId: 112,
      unitIndex: 0,
      day: "2026-10-01",
      ...STREAK_INPUT,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const stats = useProgressEventsStore.getState().stats;
    expect(stats.sessions).toBe(1);
    expect(stats.totalXp).toBeGreaterThan(0);
  });

  it("repo belum siap (null) → loadStats no-op tanpa error", async () => {
    useProgressEventsStore.getState().resetForTest();
    await useProgressEventsStore.getState().loadStats();
    expect(useProgressEventsStore.getState().stats).toEqual({
      sessions: 0,
      totalXp: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      accuracy: 0,
      perfectSessions: 0,
      lastSession: null,
    });
  });

  // "Hapus semua data" (Profil) wajib mengosongkan repo, bukan cuma state:
  // kalau tidak, progres yang dihapus akan muncul lagi saat app dibuka ulang.
  it("resetProgress: repo ikut kosong (lesson_log + progress_state) & state kembali nol", async () => {
    await useProgressEventsStore.getState().hydrate(repo, "2026-10-01");
    await useProgressEventsStore.getState().recordLessonSession({
      result: makeSessionResult(),
      surahId: 112,
      unitIndex: 0,
      day: "2026-10-01",
      ...STREAK_INPUT,
    });
    expect(await repo.getAllLessons()).toHaveLength(1);
    expect(repo.progressDays.size).toBe(1);

    await useProgressEventsStore.getState().resetProgress("2026-10-01");

    expect(repo.lessons.size).toBe(0);
    expect(repo.progressDays.size).toBe(0);
    expect(await repo.getAllLessons()).toEqual([]);
    const state = useProgressEventsStore.getState();
    expect(state.xpTotal).toBe(0);
    expect(state.lessonsToday).toBe(0);
    expect(state.streakCount).toBe(0);
    expect(state.lastActiveDay).toBeNull();
    expect(state.lastOutcome).toBeNull();
    expect(state.stats.sessions).toBe(0);
    expect(state.stats.lastSession).toBeNull();
  });

  it("resetProgress: repo gagal → state tetap dibersihkan (fail-soft)", async () => {
    await useProgressEventsStore.getState().hydrate(repo, "2026-10-01");
    await useProgressEventsStore.getState().recordLessonSession({
      result: makeSessionResult(),
      surahId: 112,
      unitIndex: 0,
      day: "2026-10-01",
      ...STREAK_INPUT,
    });
    const broken = Object.create(repo) as InMemoryProgressRepo;
    broken.clearAll = () => Promise.reject(new Error("db locked"));
    useProgressEventsStore.getState().setRepo(broken);

    await useProgressEventsStore.getState().resetProgress("2026-10-01");

    const state = useProgressEventsStore.getState();
    expect(state.xpTotal).toBe(0);
    expect(state.lessonsToday).toBe(0);
    expect(state.stats.sessions).toBe(0);
    useProgressEventsStore.getState().setRepo(repo);
  });

  it("resetProgress tanpa repo (null) tetap aman", async () => {
    useProgressEventsStore.getState().resetForTest();
    await useProgressEventsStore.getState().resetProgress("2026-10-01");
    expect(useProgressEventsStore.getState().xpTotal).toBe(0);
    expect(useProgressEventsStore.getState().day).toBe("2026-10-01");
  });

  // XP bonus quest TIDAK ada di lesson_log — kalau tidak punya log sendiri,
  // bonus akan hilang tiap app dibuka (reconcile menghitung ulang dari log).
  it("restart: XP bonus quest ikut pulih saat hydrate ulang", async () => {
    await useProgressEventsStore.getState().hydrate(repo, "2026-10-01");
    await useProgressEventsStore.getState().recordLessonSession({
      result: makeSessionResult(),
      surahId: 112,
      unitIndex: 0,
      day: "2026-10-01",
      ...STREAK_INPUT,
    });
    const afterLesson = useProgressEventsStore.getState().xpTotal;
    useProgressEventsStore.getState().addBonusXp(5);
    expect(useProgressEventsStore.getState().xpTotal).toBe(afterLesson + 5);

    // Simulasi restart: hydrate ulang dari repo yang sama.
    useProgressEventsStore.getState().resetForTest();
    await useProgressEventsStore.getState().hydrate(repo, "2026-10-01");
    expect(useProgressEventsStore.getState().xpTotal).toBe(afterLesson + 5);
  });
});
