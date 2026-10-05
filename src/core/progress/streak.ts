/**
 * Owner: core/progress. Engine streak + Streak Freeze (PRD § 5.5) — PURE &
 * data-only (aturan arah ARCHITECTURE.md § 3). Semua tanggal adalah "hari WIB"
 * (YYYY-MM-DD) dari core/time/wib — JANGAN pernah memakai zona waktu device.
 * Aturan: streak +1 saat target harian pertama kali tercapai (bukan per lesson);
 * bolong → reset; freeze menambal tepat 1 hari bolong, gratis 1×/bulan. Reset
 * ketersediaan freeze per bulan di layer store, bukan di sini.
 * Binding ke tipe domain lesson ada di features/gamification/streak.ts.
 */
import { diffDays } from "../time/wib";

/** Freeze hanya menambal tepat satu hari bolong (gap 2 hari sejak aktif terakhir). */
export const FREEZE_MAX_GAP_DAYS = 1;

export type StreakState = {
  streakCount: number;
  /** Hari WIB terakhir target harian tercapai; null = belum pernah. */
  lastActiveDate: string | null;
  /** Sisa Streak Freeze bulan berjalan. */
  freezeAvailable: boolean;
  /** Setting user: freeze otomatis on/off. */
  freezeEnabled: boolean;
};

export type StreakUpdate = {
  streakCount: number;
  lastActiveDate: string;
  freezeAvailable: boolean;
  /** true bila freeze terpakai pada update ini (untuk UI/toast). */
  freezeUsed: boolean;
};

/**
 * Dipanggil saat target harian PERTAMA KALI tercapai hari ini. Idempoten:
 * memanggil dua kali di hari WIB yang sama tidak mengubah apa pun.
 */
export function onDailyTargetReached(state: StreakState, today: string): StreakUpdate {
  if (state.lastActiveDate === today) {
    return {
      streakCount: state.streakCount,
      lastActiveDate: today,
      freezeAvailable: state.freezeAvailable,
      freezeUsed: false,
    };
  }

  const lastActive = state.lastActiveDate;
  if (lastActive === null) {
    return { streakCount: 1, lastActiveDate: today, freezeAvailable: state.freezeAvailable, freezeUsed: false };
  }

  const gap = diffDays(lastActive, today);
  if (gap === 1) {
    return { streakCount: state.streakCount + 1, lastActiveDate: today, freezeAvailable: state.freezeAvailable, freezeUsed: false };
  }

  const freezeEligible =
    gap === 1 + FREEZE_MAX_GAP_DAYS && state.freezeEnabled && state.freezeAvailable;
  if (freezeEligible) {
    return { streakCount: state.streakCount + 1, lastActiveDate: today, freezeAvailable: false, freezeUsed: true };
  }

  // Bolong tanpa penambal (atau bolong ≥ 2 hari) → streak baru dimulai dari 1.
  return { streakCount: 1, lastActiveDate: today, freezeAvailable: state.freezeAvailable, freezeUsed: false };
}
