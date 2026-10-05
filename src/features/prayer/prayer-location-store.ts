/**
 * Owner: features/prayer. Data mentah lokasi & preferensi pengingat salat.
 * Persist AsyncStorage (`ayatin-prayer-location-v1`) — sama seperti tasbih: ini
 * pengaturan, bukan peristiwa belajar, jadi tidak perlu tabel SQLite.
 *
 * Store ini SENGAJA bodoh: ia hanya menyimpan pilihan, tidak menghitung apa pun.
 * Koordinat efektif dihitung `resolveLocation` (PURE) dan penjadwalan notifikasi
 * dilakukan `PrayerSync` — dengan begitu jadwal salat tetap benar walau layarnya
 * tidak pernah dibuka.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { DEFAULT_CITY_ID, getCity } from "@/core/prayer/cities";

import type { GpsFix, PrayerLocationState } from "./prayer-plan";

const STORAGE_KEY = "ayatin-prayer-location-v1";

export const DEFAULT_PRAYER_LOCATION: PrayerLocationState = {
  cityId: DEFAULT_CITY_ID,
  source: "city",
  gps: null,
  notificationsEnabled: false,
};

export type PrayerLocationStoreState = PrayerLocationState & {
  /** Pilih kota manual (sekaligus mematikan jalur GPS, tanpa membuang fix-nya). */
  setCity: (id: string) => void;
  /** Pakai fix GPS terbaru sebagai sumber lokasi. */
  useGpsFix: (fix: GpsFix) => void;
  /** Toggle notifikasi lima waktu. Izin OS diurus layar, bukan store. */
  setNotificationsEnabled: (enabled: boolean) => void;
  /** Profil → "Hapus semua data" (RULES § 8). */
  resetAll: () => void;
};

export const usePrayerLocationStore = create<PrayerLocationStoreState>()(
  persist(
    (set) => ({
      ...DEFAULT_PRAYER_LOCATION,

      setCity: (id) => {
        // Id tak dikenal = bug UI, bukan input user → abaikan, jangan simpan
        // nilai yang bikin resolveLocation jatuh ke default diam-diam.
        if (getCity(id) === undefined) return;
        set({ cityId: id, source: "city" });
      },

      useGpsFix: (fix) => set({ gps: fix, source: "gps" }),

      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),

      resetAll: () => set({ ...DEFAULT_PRAYER_LOCATION }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      // Fungsi tidak dipersist; hanya data mentah.
      partialize: (state) => ({
        cityId: state.cityId,
        source: state.source,
        gps: state.gps,
        notificationsEnabled: state.notificationsEnabled,
      }),
    },
  ),
);
