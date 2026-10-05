/**
 * Owner: core/progress. Posisi lesson aktif — target "Lanjut Ngaji" di Home
 * (PRD § 5.2). Dipisah dari profile (settings) & reading (posisi baca mushaf):
 * satu owner per state (ARCHITECTURE.md § 1.3).
 *
 * Core = data-only: store ini tidak tahu apa itu "unit berikutnya" (itu aturan
 * features/lessons/units) — caller mengirim posisi yang sudah dihitung.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type LessonPosition = {
  surahId: number;
  unitIndex: number;
};

/** Default onboarding: mulai dari Al-Fatihah (PRD § 5.1). */
export const DEFAULT_LESSON_POSITION: LessonPosition = { surahId: 1, unitIndex: 0 };

const STORAGE_KEY = "ayatin-lesson-position-v1";

export type LessonPositionState = {
  current: LessonPosition | null;
  setCurrent: (position: LessonPosition) => void;
  reset: () => void;
};

export const useLessonPositionStore = create<LessonPositionState>()(
  persist(
    (set) => ({
      current: null,
      setCurrent: (current) => set({ current }),
      reset: () => set({ current: null }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);