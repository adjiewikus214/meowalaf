/**
 * Owner: core/progress. Posisi baca mushaf ("terakhir dibaca", PRD § 5.3).
 * Terpisah dari profile supaya scope state jelas (satu owner per state).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ReadingState = {
  lastRead: { surahId: number; ayahNumber: number } | null;
  /** Surat yang PERNAH dibuka (PRD § 6: reading_state) — input quest "buka surat" & achievement Juz 30 Explorer. */
  openedSurahIds: number[];
  markLastRead: (surahId: number, ayahNumber: number) => void;
  /** Tandai surat dibuka (dedup) — data-only. */
  markSurahOpened: (surahId: number) => void;
};

const STORAGE_KEY = "ayatin-reading-v1";

export const useReadingStore = create<ReadingState>()(
  persist(
    (set) => ({
      lastRead: null,
      openedSurahIds: [],
      markLastRead: (surahId, ayahNumber) => set({ lastRead: { surahId, ayahNumber } }),
      markSurahOpened: (surahId) =>
        set((state) =>
          state.openedSurahIds.includes(surahId)
            ? state
            : { openedSurahIds: [...state.openedSurahIds, surahId] },
        ),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
