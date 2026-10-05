/**
 * Owner: features/tasbih. State tasbih — membungkus aturan PURE di `tasbih.ts`
 * (roll hari WIB, tap, putaran, target harian) + imbalan XP & streak.
 *
 * Persist AsyncStorage (`ayatin-tasbih-v1`), sama seperti quest: hitungan tap
 * bukan peristiwa belajar, jadi tidak perlu tabel SQLite sendiri. Yang PENTING
 * persisten adalah hadiah XP — dan itu sudah lewat `xp_ledger` (`addBonusXp`),
 * bukan state di sini. `paidPresetIds`/`targetPaid` mencegah pembayaran dobel
 * saat app di-reload di hari yang sama.
 *
 * Arah dependensi: features → core boleh; core TIDAK meng-import file ini.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { useProgressEventsStore } from "@/core/progress/lesson-store";
import { useProfileStore } from "@/core/progress/store";
import { todayWib } from "@/core/time/wib";
import { useAchievementStore } from "@/features/gamification/achievement-store";
import { useQuestStore } from "@/features/gamification/quest-store";

import {
  TASBIH_XP_PER_PRESET,
  TASBIH_XP_TARGET,
  applyTap,
  initialTasbihDay,
  rollTasbihDay,
  tasbihTotal,
  withTarget,
  type TasbihDayState,
  type TasbihPreset,
  type TasbihPresetId,
} from "./tasbih";

const STORAGE_KEY = "ayatin-tasbih-v1";

export type TasbihStoreState = TasbihDayState & {
  /** Preset yang sedang dipilih di layar. */
  activePresetId: TasbihPresetId;
  /** Panggil saat layar dibuka: roll ke hari WIB berjalan bila sudah ganti hari. */
  ensureToday: (day?: string) => void;
  selectPreset: (id: TasbihPresetId) => void;
  /**
   * Satu tap pada preset. Mengembalikan XP yang didapat + preset yang baru
   * dibayar (untuk umpan balik UI); null/0 = tap biasa.
   */
  tap: (preset: TasbihPreset, day?: string) => { xpEarned: number; paidPresetId: TasbihPresetId | null };
  setTarget: (target: number) => void;
  /** Profil → "Hapus semua data": state kembali ke hari ini, target dibawa. */
  resetAll: () => void;
  resetForTest: () => void;
};

export const useTasbihStore = create<TasbihStoreState>()(
  persist(
    (set, get) => ({
      ...initialTasbihDay(todayWib()),
      activePresetId: "subhanallah",

      ensureToday: (day = todayWib()) => {
        const rolled = rollTasbihDay(get(), day);
        if (rolled !== get()) set(rolled);
      },

      selectPreset: (id) => set({ activePresetId: id }),

      tap: (preset, day = todayWib()) => {
        const { state, xpEarned, paidPresetId, targetReachedNow } = applyTap(get(), day, preset);
        set(state);
        const events = useProgressEventsStore.getState();
        // Tasbih adalah SUMBER data; quest & achievement hanya membacanya.
        // Dipanggil tiap tap (bukan tiap hadiah) supaya progres quest ikut
        // bergerak walau bonusnya sudah dibayar hari ini.
        useQuestStore.getState().dzikirProgress(day, tasbihTotal(state));
        useAchievementStore.getState().onDzikirTap();
        if (paidPresetId !== null) {
          // Satu entri ledger per preset, alasan spesifik supaya rekap bisa
          // menunjukkan asal XP-nya (pola achievementBonusReason).
          events.addBonusXp(TASBIH_XP_PER_PRESET, `tasbih:${preset.id}`);
        }
        if (targetReachedNow) {
          events.addBonusXp(TASBIH_XP_TARGET, "tasbih:target");
          // Streak lewat aksi generik — tidak menambah lessonsToday, dan
          // idempoten dengan jalur lesson (lihat applyExternalTargetReached).
          events.reachDailyTarget(day, { freezeEnabled: useProfileStore.getState().freezeEnabled });
        }
        return { xpEarned, paidPresetId };
      },

      setTarget: (target) => {
        // Hanya target yang berubah — hitungan hari ini dibawa (withTarget PURE).
        set(withTarget(get(), target));
      },

      resetAll: () => {
        // Preset aktif dibawa (ini pilihan tampilan, bukan progres); hitungan,
        // paidPresetIds, dan targetPaid kembali nol untuk hari ini.
        set({ ...initialTasbihDay(todayWib(), get().target), activePresetId: get().activePresetId });
      },

      resetForTest: () => get().resetAll(),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      // Fungsi tidak ikut persist — hanya data harian + preset aktif.
      partialize: (state) => ({
        day: state.day,
        counts: state.counts,
        target: state.target,
        paidPresetIds: state.paidPresetIds,
        targetPaid: state.targetPaid,
        activePresetId: state.activePresetId,
      }),
    },
  ),
);
