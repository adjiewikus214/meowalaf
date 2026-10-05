/**
 * Owner: features/gamification. State daily quest — membungkus aturan PURE di
 * quests.ts (roll hari WIB, hitung progres, deteksi selesai) + imbalan XP.
 * Persist AsyncStorage (kunci `ayatin-quests-v1`): completedIds harus selamat
 * reload supaya +5 XP tidak dobel; quest besok di-roll otomatis dari tanggal
 * (generator deterministik — reload hari yang sama memberi quest identik).
 *
 * Arah dependensi: features → core boleh (baca lesson-store untuk memberi XP);
 * core TIDAK meng-import file ini (ARCHITECTURE.md § 3).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { useProgressEventsStore } from "@/core/progress/lesson-store";
import { todayWib } from "@/core/time/wib";

import {
  QUEST_XP_REWARD,
  applyDzikir,
  applyLessonCompleted,
  applySurahOpened,
  initialQuestDay,
  rollQuestDay,
  type QuestDayState,
} from "./quests";

const STORAGE_KEY = "ayatin-quests-v1";

export type QuestStoreState = QuestDayState & {
  /** Panggil saat layar dibuka: roll ke hari WIB berjalan bila sudah ganti hari. */
  ensureToday: (day?: string) => void;
  /** Satu lesson selesai → progres + hadiah XP untuk quest yang baru selesai. */
  lessonCompleted: (day: string, delta: { correct: number; perfect: boolean }) => void;
  /** Satu surat dibuka → progres quest kategori surah (dedup per hari). */
  surahOpened: (day: string, surahId: number) => void;
  /**
   * Total dzikir hari ini berubah (tasbih yang memanggil, quest yang menilai).
   * Nilai yang lebih rendah dari sebelumnya diabaikan — reset hitungan tasbih
   * tidak boleh membatalkan quest yang sudah selesai.
   */
  dzikirProgress: (day: string, total: number) => void;
  /** Profil → "Hapus semua data": quest di-roll ulang untuk hari ini. */
  resetAll: () => void;
  resetForTest: () => void;
};

export const useQuestStore = create<QuestStoreState>()(
  persist(
    (set, get) => ({
      ...initialQuestDay(todayWib()),

      ensureToday: (day = todayWib()) => {
        const rolled = rollQuestDay(get(), day);
        if (rolled !== get()) set(rolled);
      },

      lessonCompleted: (day, delta) => {
        const { state, completed } = applyLessonCompleted(get(), day, delta);
        set(state);
        if (completed.length > 0) {
          useProgressEventsStore.getState().addBonusXp(completed.length * QUEST_XP_REWARD);
        }
      },

      surahOpened: (day, surahId) => {
        const { state, completed } = applySurahOpened(get(), day, surahId);
        set(state);
        if (completed.length > 0) {
          useProgressEventsStore.getState().addBonusXp(completed.length * QUEST_XP_REWARD);
        }
      },

      dzikirProgress: (day, total) => {
        const { state, completed } = applyDzikir(get(), day, total);
        set(state);
        if (completed.length > 0) {
          useProgressEventsStore.getState().addBonusXp(completed.length * QUEST_XP_REWARD);
        }
      },

      resetAll: () => set(initialQuestDay(todayWib())),

      resetForTest: () => get().resetAll(),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
