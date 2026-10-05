/**
 * Owner: features/gamification. State achievement — daftar unlock + statistik
 * lifetime, membungkus aturan PURE di achievements.ts. Persist AsyncStorage
 * (kunci `ayatin-achievements-v1`): unlock SEKALI dan bertahan reload
 * (AC PRD § 5.5) — bahkan sebelum SQLite terpasang.
 *
 * Statistik dikumpulkan di sini (lesson selesai, T4 benar, perfect); streak
 * & jumlah surat terbuka dibaca dari store pemiliknya saat evaluasi. Kalau
 * SQLite sudah terpasang, statistik ini bisa direkonstruksi ulang dari
 * lesson_log/reading_state (TODO bersama migration v2).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { useProgressEventsStore } from "@/core/progress/lesson-store";
import { useReadingStore } from "@/core/progress/reading";

import {
  ACHIEVEMENTS,
  achievementBonusReason,
  achievementXpReward,
  evaluateAchievements,
  getAchievement,
  type AchievementId,
  type AchievementStats,
} from "./achievements";

const STORAGE_KEY = "ayatin-achievements-v1";

/** Statistik lifetime yang dimiliki store ini (streak & surat dari store lain). */
export type LifetimeStats = {
  lessonsCompleted: number;
  correctT4: number;
  perfectLessons: number;
  /** Total dzikir seumur hidup — ditambah per tap tasbih, bukan dari hitungan harian. */
  dzikirTotal: number;
};

export type AchievementStoreState = {
  unlocked: readonly AchievementId[];
  stats: LifetimeStats;
  /** Unlock pada sesi berjalan (untuk toast) — sengaja tidak persist. */
  lastUnlocked: readonly AchievementId[];
  /** Satu lesson selesai → tambah statistik, evaluasi, kembalikan yang baru terbuka. */
  onLessonCompleted: (delta: { correctT4: number; perfect: boolean }) => AchievementId[];
  /** Satu surat dibuka → evaluasi (Juz 30 Explorer); kembalikan yang baru terbuka. */
  onSurahOpened: () => AchievementId[];
  /**
   * Satu tap dzikir (tasbih) → tambah total lifetime & evaluasi. `delta` selalu
   * 1 dari UI, tapi tetap parameter supaya tes bisa memakai angka besar tanpa
   * 1000 iterasi.
   */
  onDzikirTap: (delta?: number) => AchievementId[];
  clearLastUnlocked: () => void;
  /** Profil → "Hapus semua data": kosongkan daftar unlock + statistik lifetime. */
  resetAll: () => void;
  resetForTest: () => void;
};

function currentStats(get: () => AchievementStoreState, extra: Partial<AchievementStats>): AchievementStats {
  const state = get();
  return {
    lessonsCompleted: state.stats.lessonsCompleted,
    correctT4: state.stats.correctT4,
    perfectLessons: state.stats.perfectLessons,
    dzikirTotal: state.stats.dzikirTotal,
    streakCount: useProgressEventsStore.getState().streakCount,
    openedSurahCount: useReadingStore.getState().openedSurahIds.length,
    ...extra,
  };
}

/**
 * Beri XP untuk achievement yang baru terbuka, lewat xp_ledger yang sama dengan
 * hadiah quest (addBonusXp). Satu entri ledger PER achievement — bukan satu
 * entri jumlah — supaya rekap tetap bisa menunjukkan asal XP-nya.
 *
 * Yang menjaga supaya XP tidak dobel: `evaluateAchievements` sudah menyaring
 * yang belum pernah terbuka, dan daftar `unlocked` di-persist. Jadi jalur ini
 * hanya mungkin dieksekusi sekali per achievement, seumur akun.
 */
function awardXpFor(fresh: readonly AchievementId[]): void {
  for (const id of fresh) {
    useProgressEventsStore
      .getState()
      .addBonusXp(achievementXpReward(getAchievement(id)), achievementBonusReason(id));
  }
}

export const useAchievementStore = create<AchievementStoreState>()(
  persist(
    (set, get) => ({
      unlocked: [],
      stats: { lessonsCompleted: 0, correctT4: 0, perfectLessons: 0, dzikirTotal: 0 },
      lastUnlocked: [],

      onLessonCompleted: (delta) => {
        const state = get();
        const stats = currentStats(get, {
          lessonsCompleted: state.stats.lessonsCompleted + 1,
          correctT4: state.stats.correctT4 + Math.max(0, delta.correctT4),
          perfectLessons: state.stats.perfectLessons + (delta.perfect ? 1 : 0),
        });
        const fresh = evaluateAchievements(stats, state.unlocked);
        set({
          stats: {
            lessonsCompleted: stats.lessonsCompleted,
            correctT4: stats.correctT4,
            perfectLessons: stats.perfectLessons,
            dzikirTotal: stats.dzikirTotal,
          },
          unlocked: [...state.unlocked, ...fresh],
          lastUnlocked: fresh,
        });
        if (fresh.length > 0) {
          awardXpFor(fresh);
          console.log(`[achievement] terbuka: ${fresh.join(", ")}`);
        }
        return fresh;
      },

      onDzikirTap: (delta = 1) => {
        const state = get();
        const amount = Math.max(0, Math.floor(delta));
        if (amount === 0) return [];
        // Statistik ditulis dulu, evaluasi memakai nilai baru — kalau evaluasi
        // dulu, achievement yang tepat di ambang tidak akan pernah terbuka.
        const stats = currentStats(get, { dzikirTotal: state.stats.dzikirTotal + amount });
        const fresh = evaluateAchievements(stats, state.unlocked);
        set({
          stats: { ...state.stats, dzikirTotal: stats.dzikirTotal },
          unlocked: [...state.unlocked, ...fresh],
          ...(fresh.length > 0 ? { lastUnlocked: fresh } : {}),
        });
        if (fresh.length > 0) {
          awardXpFor(fresh);
          console.log(`[achievement] terbuka: ${fresh.join(", ")}`);
        }
        return fresh;
      },

      onSurahOpened: () => {
        const state = get();
        const stats = currentStats(get, {});
        const fresh = evaluateAchievements(stats, state.unlocked);
        if (fresh.length > 0) {
          set({ unlocked: [...state.unlocked, ...fresh], lastUnlocked: fresh });
          awardXpFor(fresh);
          console.log(`[achievement] terbuka: ${fresh.join(", ")}`);
        }
        return fresh;
      },

      clearLastUnlocked: () => set({ lastUnlocked: [] }),

      resetAll: () =>
        set({
          unlocked: [],
          stats: { lessonsCompleted: 0, correctT4: 0, perfectLessons: 0, dzikirTotal: 0 },
          lastUnlocked: [],
        }),

      resetForTest: () => get().resetAll(),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      // lastUnlocked = toast sesi berjalan; jangan ikut persist (hindari toast usang saat reload).
      partialize: (state) => ({ unlocked: state.unlocked, stats: state.stats }),
    },
  ),
);

/** Semua definisi achievement — titik import tunggal untuk UI. */
export { ACHIEVEMENTS };
