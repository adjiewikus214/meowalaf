/**
 * Owner: core/progress. Fase boot — apakah data progres boleh ditampilkan sebagai
 * angka nyata.
 *
 * Latar (ADR-009): dulu splash ditahan sampai SQLite selesai dibuka, supaya
 * Home tidak pernah muncul dengan angka 0 lalu melonkat. Sekarang Home boleh
 * tampil lebih dulu — tapi angka progres yang belum termuat TIDAK boleh tampil
 * sebagai 0, karena "0" itu klaim, bukan "belum tahu". Di sinilah keputusan itu
 * dinyatakan, sebagai fungsi murni yang bisa dites, bukan sebagai `if` yang
 * tersebar di beberapa layar.
 *
 * Boleh di-import app/ dan features/ (core tidak import mereka balik).
 */
import { create } from "zustand";

/**
 * - `loading`  : repo belum siap, angka progres belum nyata.
 * - `ready`    : store progres sudah ter-hydrate dari repo (SQLite ATAU
 *                fallback in-memory — status storage yang jujur soal mana).
 * - `timeout`  : batas waktu keamanan terlampaui sebelum hydrate selesai.
 *                Perlakukan seperti `ready` (app harus bisa dipakai), persis
 *                seperti perilaku sebelum ADR-009.
 */
export type HydrationPhase = "loading" | "ready" | "timeout";

export type HydrationState = {
  phase: HydrationPhase;
  setPhase: (phase: HydrationPhase) => void;
  resetForTest: () => void;
};

const INITIAL: HydrationPhase = "loading";

export const useHydrationStore = create<HydrationState>()((set) => ({
  phase: INITIAL,
  setPhase: (phase) => set({ phase }),
  resetForTest: () => set({ phase: INITIAL }),
}));

/** Fase "angka progres boleh ditampilkan sebagai nyata". */
export function isProgressTrusted(phase: HydrationPhase): boolean {
  return phase !== "loading";
}

/**
 * Apakah layar harus menampilkan placeholder untuk angka progres.
 *
 * Dua sumber sengaja digabung:
 * 1. Fase boot (`hydration-store`) - penanda kasar bahwa kita masih membuka DB.
 * 2. `status` store progres (`idle` | `hydrating` | `ready`) — sumber yang
 *    paling dekat dengan datanya, jadi kalau ia sudah `ready` kita tidak perlu
 *    menunggu fase boot yang lebih kasar.
 *
 * Dipisah supaya tidak ada layar yang deciding sendiri "apakah ini sudah siap".
 */
export function isProgressLoading(phase: HydrationPhase, progressStatus: "idle" | "hydrating" | "ready"): boolean {
  return !isProgressTrusted(phase) && progressStatus !== "ready";
}

/** Setter non-hook (dipakai dari effect async di luar React). */
export function setHydrationPhase(phase: HydrationPhase): void {
  useHydrationStore.getState().setPhase(phase);
}

/** Kembalikan ke kondisi awal (test). */
export function resetHydrationForTest(): void {
  useHydrationStore.getState().resetForTest();
}