/**
 * Owner: core/progress. SATU owner runtime state progres lesson/gamifikasi
 * (ARCHITECTURE.md § 4.3): zustand = sumber kebenaran runtime, SQLite (repo) =
 * sumber kebenaran persisten. Semua mutasi lewat actions di sini; komponen hanya
 * subscribe. Modul ini DATA-ONLY: aturan XP/streak DIINJEKSI dari features
 * (aturan arah ARCHITECTURE § 3: core tidak boleh import features) — binding
 * ada di features/lessons/persist.ts.
 *
 * Kill-app safety (ROADMAP § 3): sesi tidak selesai tidak mencatat apa pun (sesi
 * hidup di memori UI); sesi selesai dicatat ATOMIK per lesson (idempoten pada
 * lessonId → replay tidak dobel), lalu baris harian di-upsert. Bila crash terjadi
 * di antara keduanya, hydrate merekonsiliasi agregat harian dari lesson_log.
 */
import { create } from "zustand";

import { todayWib } from "../time/wib";

import type { ProgressRepo, ProgressDayRow, SaveOutcome, LessonRecord, RepoLessonEvent } from "../db/progress-repo";
import { bonusXpId, xpForEvents } from "./xp";
import { onDailyTargetReached } from "./streak";
import { computeLessonStats, emptyLessonStats, type LessonStats } from "./stats";
import { computeWeeklyTrend, emptyWeeklyTrend, type WeeklyTrend } from "./weekly";

/** Data harian yang dimiliki store — satu owner, komponen hanya subscribe. */
export type ProgressEventsData = {
  /** Hari WIB aktif (YYYY-MM-DD) — ganti hari → agregat harian mulai dari nol. */
  day: string;
  xpTotal: number;
  streakCount: number;
  lastActiveDay: string | null;
  /** Sisa Streak Freeze bulan berjalan (reset per bulan: settings, bukan di sini). */
  freezeAvailable: boolean;
  freezeUsedDay: string | null;
  lessonsToday: number;
  correctToday: number;
};

export type StreakInput = {
  /** Setting user: freeze otomatis on/off (owner: profile store). */
  freezeEnabled: boolean;
  /** Target harian user (jumlah lesson/hari, PRD § 5.1). */
  dailyTarget: number;
};

const INITIAL_DAY = "0000-00-00";

export function initialProgressData(day: string = INITIAL_DAY): ProgressEventsData {
  return {
    day,
    xpTotal: 0,
    streakCount: 0,
    lastActiveDay: null,
    freezeAvailable: true,
    freezeUsedDay: null,
    lessonsToday: 0,
    correctToday: 0,
  };
}

/** Jumlah jawaban benar (termasuk percobaan ulang) dari events satu sesi. */
export function countCorrectEvents(events: readonly { type: string }[]): number {
  return events.filter((event) => event.type === "ANSWER_CORRECT").length;
}

/**
 * Terapkan satu lesson selesai ke data harian — PURE & idempoten di level rekam
 * (duplikat tidak pernah sampai sini; repo menolaknya lebih dulu). Streak +1 hanya
 * saat target harian PERTAMA kali tercapai hari itu (aturan streak.ts).
 */
export function applyLessonRecord(
  current: ProgressEventsData,
  record: LessonRecord,
  input: StreakInput,
): ProgressEventsData {
  const base: ProgressEventsData =
    current.day === record.day
      ? current
      : {
          ...current,
          day: record.day,
          xpTotal: 0,
          lessonsToday: 0,
          correctToday: 0,
        };

  const targetAlreadyReached = base.lessonsToday >= input.dailyTarget;
  const next: ProgressEventsData = {
    ...base,
    xpTotal: base.xpTotal + record.xpEarned,
    lessonsToday: base.lessonsToday + 1,
    correctToday: base.correctToday + countCorrectEvents(record.events),
  };

  // Streak +1 HANYA saat lesson ini MENYEBABKAN target harian tercapai pertama
  // kali (aturan streak.ts) — bukan tiap lesson.
  const targetReachedNow = next.lessonsToday >= input.dailyTarget;
  if (targetAlreadyReached || !targetReachedNow) return next;

  const streak = onDailyTargetReached(
    {
      streakCount: next.streakCount,
      lastActiveDate: next.lastActiveDay,
      freezeAvailable: next.freezeAvailable,
      freezeEnabled: input.freezeEnabled,
    },
    record.day,
  );
  return {
    ...next,
    streakCount: streak.streakCount,
    lastActiveDay: streak.lastActiveDate,
    freezeAvailable: streak.freezeAvailable,
    freezeUsedDay: streak.freezeUsed ? record.day : next.freezeUsedDay,
  };
}

/**
 * Aktivitas di luar lesson (saat ini: tasbih) yang mencapai target hariannya
 * sendiri. Ia TIDAK menambah `lessonsToday` (ring Home itu hitungan lesson),
 * hanya menerapkan aturan streak yang sama — karena `onDailyTargetReached`
 * idempoten per hari, tasbih & lesson tidak bisa menghitung streak dua kali:
 * yang pertama mencapai target harian hari itu yang menaikkannya.
 */
export function applyExternalTargetReached(
  current: ProgressEventsData,
  day: string,
  input: { freezeEnabled: boolean },
): ProgressEventsData {
  const base: ProgressEventsData =
    current.day === day ? current : { ...current, day, xpTotal: 0, lessonsToday: 0, correctToday: 0 };
  if (base.lastActiveDay === day) return base; // streak hari ini sudah naik
  const streak = onDailyTargetReached(
    {
      streakCount: base.streakCount,
      lastActiveDate: base.lastActiveDay,
      freezeAvailable: base.freezeAvailable,
      freezeEnabled: input.freezeEnabled,
    },
    day,
  );
  return {
    ...base,
    streakCount: streak.streakCount,
    lastActiveDay: streak.lastActiveDate,
    freezeAvailable: streak.freezeAvailable,
    freezeUsedDay: streak.freezeUsed ? day : base.freezeUsedDay,
  };
}

function dataToRow(data: ProgressEventsData): ProgressDayRow {
  return {
    day: data.day,
    xpTotal: data.xpTotal,
    streakCount: data.streakCount,
    lastActiveDay: data.lastActiveDay,
    freezeAvailable: data.freezeAvailable,
    freezeUsedDay: data.freezeUsedDay,
    lessonsToday: data.lessonsToday,
    correctToday: data.correctToday,
  };
}

/**
 * Recovery path (ARCHITECTURE § 5): bangun ulang agregat harian dari lesson_log.
 * Field streak/freeze dibawa dari baris harian TERAKHIR ≤ `day` (bisa hari
 * sebelumnya — efek streak diterapkan saat target tercapai, bukan dihitung ulang
 * lintas hari di sini).
 */
export async function reconcileProgressDay(repo: ProgressRepo, day: string): Promise<ProgressEventsData> {
  const [latestRow, lessons, bonuses] = await Promise.all([
    repo.getLatestProgressDayUpTo(day),
    repo.getLessonsByDay(day),
    repo.getBonusXpByDay(day),
  ]);
  const streakFields =
    latestRow === null
      ? { streakCount: 0, lastActiveDay: null, freezeAvailable: true, freezeUsedDay: null }
      : {
          streakCount: latestRow.streakCount,
          lastActiveDay: latestRow.lastActiveDay,
          freezeAvailable: latestRow.freezeAvailable,
          freezeUsedDay: latestRow.freezeUsedDay,
        };
  return {
    day,
    xpTotal:
      lessons.reduce((sum, lesson) => sum + xpForEvents(lesson.events), 0) +
      bonuses.reduce((sum, entry) => sum + entry.amount, 0),
    lessonsToday: lessons.length,
    correctToday: lessons.reduce((sum, lesson) => sum + countCorrectEvents(lesson.events), 0),
    ...streakFields,
  };
}

export type RecordLessonInput = {
  /** Hasil finishSession() — sesi TIDAK selesai tidak boleh dipanggil ke sini. */
  result: { xpEarned: number; accuracy: number; perfect: boolean; events: readonly RepoLessonEvent[] };
  surahId: number;
  unitIndex: number;
  day: string;
} & StreakInput;

export type ProgressEventsState = ProgressEventsData & {
  status: "idle" | "hydrating" | "ready";
  /** Outcome pencatatan terakhir (untuk toast/debug). */
  lastOutcome: SaveOutcome | null;
  /** Rekap statistik profil dari lesson_log (PRD § 5.6) — di-refresh via loadStats. */
  stats: LessonStats;
  /** Tren 7 hari dari lesson_log (grafik Profil) — dihitung bersama stats. */
  weekly: WeeklyTrend;
  hydrate: (repo: ProgressRepo, day: string) => Promise<void>;
  /** Muat ulang statistik profil dari lesson_log (fail-soft: gagal → rekap kosong). */
  loadStats: () => Promise<void>;
  recordLessonSession: (input: RecordLessonInput) => Promise<SaveOutcome>;
  /** Bonus XP di luar sesi (hadiah quest, PRD § 5.5) — data-only. */
  addBonusXp: (amount: number, reason?: string) => void;
  /**
   * Target harian tercapai dari aktivitas non-lesson (tasbih): streak +1 kalau
   * hari ini belum ada aktivitas apa pun yang menaikkannya. Idempoten.
   */
  reachDailyTarget: (day: string, input: { freezeEnabled: boolean }) => void;
  /** Ganti repo aktif (dipakai app saat buka DB & test dengan in-memory repo). */
  setRepo: (repo: ProgressRepo) => void;
  /**
   * Hapus semua progres tersimpan (Profil → "Hapus semua data"): kosongkan repo
   * + state harian + rekap statistik. Dipisah dari resetForTest karena ini
   * perubahan data users mileage sungguhan, bukan sekadar reset state test.
   */
  resetProgress: (day: string) => Promise<void>;
  resetForTest: () => void;
};

/** Repo aktif — diset saat hydrate/setRepo; satu-satunya jalan ke storage. */
let activeRepo: ProgressRepo | null = null;

/**
 * Penomoran entri xp_ledger (lihat bonusXpId). Berbeda dari counter lesson,
 * ini TIDAK pernah di-reset: nomor yang pernah dipakai tidak akan dipakai lagi
 * walau achievement dibayar ulang setelah "Hapus semua data".
 */
let bonusSequence = 0;

export const useProgressEventsStore = create<ProgressEventsState>((set, get) => ({
  ...initialProgressData(),
  status: "idle",
  lastOutcome: null,
  stats: emptyLessonStats(),
  weekly: emptyWeeklyTrend(),

  loadStats: async () => {
    const repo = activeRepo;
    if (repo === null) return; // repo belum siap → biarkan rekap apa adanya (fail-soft)
    try {
      // XP total Profil = sesi + bonus quest (kedua sumber XP di app). Grafik 7
      // hari reakai lessons yang sama — tanpa query kedua.
      const [lessons, bonuses] = await Promise.all([repo.getAllLessons(), repo.getAllBonusXp()]);
      const bonusXpTotal = bonuses.reduce((sum, entry) => sum + entry.amount, 0);
      set({
        stats: computeLessonStats(lessons, bonusXpTotal),
        weekly: computeWeeklyTrend(lessons, todayWib()),
      });
    } catch (error) {
      console.warn("[progress] loadStats gagal:", error instanceof Error ? error.message : String(error));
      set({ stats: emptyLessonStats() });
    }
  },

  hydrate: async (repo, day) => {
    set({ status: "hydrating" });
    try {
      await repo.migrate();
      const reconciled = await reconcileProgressDay(repo, day);
      activeRepo = repo;
      set({ ...reconciled, status: "ready" });
      // Di-await (bukan void): Home/Profil menampilkan XP lifetime dari stats.
      // Sejak ADR-009 splash tidak lagi menunggu DB, jadi yang menjaga "angka
      // tidak melompat" bukan splash tapi placeholder di layar
      // (`isProgressLoading`) - lihat hydration-store.
      await get().loadStats(); // rekap profil ikut terisi saat app bangun
    } catch (error) {
      // Fail-soft (RULES § 4): DB gagal → app tetap jalan dengan progres nol hari ini.
      console.warn("[progress] hydrate gagal:", error instanceof Error ? error.message : String(error));
      set({ ...initialProgressData(), day, status: "ready" });
    }
  },

  recordLessonSession: async ({ result, surahId, unitIndex, day, dailyTarget, freezeEnabled }) => {
    const repo = activeRepo;
    const state = get();
    const current: ProgressEventsData =
      state.day === day ? state : { ...initialProgressData(), day };
    const completedAt = new Date().toISOString();
    const record: LessonRecord = {
      id: `lesson-${completedAt}`,
      day,
      surahId,
      unitIndex,
      xpEarned: result.xpEarned,
      accuracy: result.accuracy,
      perfect: result.perfect,
      events: result.events,
      completedAt,
    };

    // 1) Log append-only ATOMIK lebih dulu — sumber kebenaran yang bisa direkonstruksi.
    //    Repo belum siap (DB gagal/belum hydrate) → progres hari ini tetap berjalan,
    //    hanya tidak ter-persist (konsisten dengan fail-soft hydrate).
    if (repo === null) {
      const next = applyLessonRecord(current, record, { dailyTarget, freezeEnabled });
      set({ ...next, lastOutcome: "saved" });
      return "saved";
    }
    const outcome = await repo.recordLessonSession(record);
    if (outcome === "duplicate") {
      set({ lastOutcome: "duplicate" });
      return "duplicate";
    }
    // 2) Baris harian di-upsert; gagal di sini disembuhkan oleh reconcile saat hydrate.
    const next = applyLessonRecord(current, record, { dailyTarget, freezeEnabled });
    try {
      await repo.saveProgressDay(dataToRow(next));
    } catch (error) {
      console.warn("[progress] saveProgressDay gagal (recovery via reconcile):", error instanceof Error ? error.message : String(error));
    }
    set({ ...next, lastOutcome: outcome });
    void get().loadStats(); // rekap profil segar tanpa menunggu buka layar Profil
    return outcome;
  },

  setRepo: (repo) => {
    activeRepo = repo;
  },

  resetProgress: async (day) => {
    const repo = activeRepo;
    // Fail-soft: walau repo gagal dikosongkan, state memori tetap dibersihkan —
    // lebih baik tampil nol sementara daripada nampilin progres yang dihapus user.
    if (repo !== null) {
      try {
        await repo.clearAll();
      } catch (error) {
        console.warn("[progress] clearAll gagal:", error instanceof Error ? error.message : String(error));
      }
    }
    set({
      ...initialProgressData(day),
      status: "ready",
      lastOutcome: null,
      stats: emptyLessonStats(),
      weekly: emptyWeeklyTrend(),
    });
  },

  addBonusXp: (amount, reason = "quest") => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    set({ xpTotal: get().xpTotal + amount });
    const repo = activeRepo;
    if (repo === null) return; // repo belum siap → bonus tetap hidup di memori (fail-soft)
    // Bonus dicatat di xp_ledger (append-only) + snapshot harian di-upsert.
    // Ledger yang bikin bonus selamat hydrate: reconcile XP hanya dari lesson_log
    // + xp_ledger, bukan dari snapshot progress_state.
    const day = get().day;
    const createdAt = new Date().toISOString();
    bonusSequence += 1;
    const entry = { id: bonusXpId(createdAt, bonusSequence), day, amount, reason, createdAt };
    // Dua tulisan dijalankan BERURUTAN, bukan Promise.all: keduanya statement
    // pada satu koneksi SQLite, dan wa-sqlite (web worker / OPFS) bisa gagal
    // "Error finalizing statement" kalau dua statement berjalan bareng.
    void (async () => {
      try {
        await repo.recordBonusXp(entry);
        await repo.saveProgressDay(dataToRow(get()));
      } catch (error) {
        console.warn(
          "[progress] simpan bonus XP gagal:",
          error instanceof Error ? error.message : String(error),
        );
      }
    })();
    void get().loadStats();
  },

  reachDailyTarget: (day, input) => {
    const next = applyExternalTargetReached(get(), day, input);
    set(next);
    const repo = activeRepo;
    if (repo === null) return; // repo belum siap → streak hidup di memori (fail-soft)
    void repo.saveProgressDay(dataToRow(next)).catch((error: unknown) => {
      console.warn(
        "[progress] saveProgressDay (target non-lesson) gagal:",
        error instanceof Error ? error.message : String(error),
      );
    });
  },

  resetForTest: () => {
    activeRepo = null;
    set({
      ...initialProgressData(),
      status: "idle",
      lastOutcome: null,
      stats: emptyLessonStats(),
      weekly: emptyWeeklyTrend(),
    });
  },
}));
