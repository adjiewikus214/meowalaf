/**
 * Owner: core/progress. Satu owner state profil & settings (PRD § 5.7).
 * MVP tanpa sqlite: preferensi persist di async-storage via zustand persist.
 * (lesson_log/answer_log masuk Phase 2 bersama engine gamifikasi.)
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { DEFAULT_RECITER_ID } from "../content/meta";
import { DEFAULT_LOCALE, type Locale } from "../i18n";
import type { ArabicFontScale } from "../../ui/tokens";

export type { ArabicFontScale };

export type ProfileState = {
  displayName: string;
  avatar: string;
  dailyTarget: number; // jumlah lesson/hari (PRD § 5.1)
  reciterId: string;
  arabFontScale: ArabicFontScale;
  /** Streak Freeze otomatis on/off (PRD § 5.5; default on). */
  freezeEnabled: boolean;
  /** Pengingat harian on/off (mobile only, ROADMAP § 4). */
  reminderEnabled: boolean;
  /** Jam pengingat lokal 0..23; default setelah maghrib (lihat features/reminders). */
  reminderHour: number;
  /**
   * Bahasa UI (core/i18n). Default Indonesia dan SENGAJA tidak mengikuti bahasa
   * perangkat — lihat catatan di core/i18n/index.ts. Disimpan bersama setting
   * lain, jadi pilihan user bertahan setelah app ditutup.
   */
  locale: Locale;
  onboarded: boolean;
  setDisplayName: (name: string) => void;
  setAvatar: (avatar: string) => void;
  setDailyTarget: (target: number) => void;
  setReciter: (id: string) => void;
  setArabicFontScale: (scale: ArabicFontScale) => void;
  setFreezeEnabled: (enabled: boolean) => void;
  setReminderEnabled: (enabled: boolean) => void;
  setReminderHour: (hour: number) => void;
  setLocale: (locale: Locale) => void;
  completeOnboarding: (target: number) => void;
  resetAll: () => void;
};

export const AVATAR_CHOICES = ["🕌", "🌙", "✨", "📖", "🤲", "🕊️", "⭐", "🌌"] as const;

const DEFAULT_PROFILE = {
  displayName: "Sahabat",
  avatar: "🕌",
  dailyTarget: 1,
  reciterId: DEFAULT_RECITER_ID,
  arabFontScale: "M" as ArabicFontScale,
  freezeEnabled: true,
  reminderEnabled: false,
  reminderHour: 19, // setelah maghrib — default features/reminders
  locale: DEFAULT_LOCALE,
  onboarded: false,
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      ...DEFAULT_PROFILE,
      setDisplayName: (displayName) => set({ displayName }),
      setAvatar: (avatar) => set({ avatar }),
      setDailyTarget: (dailyTarget) => set({ dailyTarget }),
      setReciter: (reciterId) => set({ reciterId }),
      setArabicFontScale: (arabFontScale) => set({ arabFontScale }),
      setFreezeEnabled: (freezeEnabled) => set({ freezeEnabled }),
      setReminderEnabled: (reminderEnabled) => set({ reminderEnabled }),
      setReminderHour: (reminderHour) => set({ reminderHour }),
      setLocale: (locale) => set({ locale }),
      completeOnboarding: (dailyTarget) => set({ dailyTarget, onboarded: true }),
      resetAll: () => set({ ...DEFAULT_PROFILE }),
    }),
    {
      name: "ayatin-profile-v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
