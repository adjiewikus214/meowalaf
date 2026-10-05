/**
 * Owner: core/db. Status penyimpanan progres — dibaca UI supaya app TIDAK
 * berbohong. Sebelumnya DB gagal dibuka → fallback in-memory diam-diam, user
 * mengira progresnya aman padahal hilang begitu tab ditutup. Sekarang setiap
 * keadaan punya nama dan UI bisa menampilkannya.
 *
 * Boleh di-import app/ dan features/ (core tidak boleh import mereka balik).
 */
import { create } from "zustand";

export type StoragePhase =
  /** Sedang membuka DB. */
  | "opening"
  /** Tab lain sedang memegang DB; kita menunggu lock-nya dilepas. */
  | "waiting"
  /** Normal: SQLite/OPFS aktif, progres tersimpan. */
  | "sqlite"
  /** Fallback: progres hanya hidup selama app terbuka. */
  | "memory";

export type StorageStatus = {
  phase: StoragePhase;
  /** Kenapa tidak pakai SQLite (isi banner). */
  reason: string | null;
  /** True kalau penyebabnya tab lain yang memegang DB (bukan kerusakan storage). */
  otherTab: boolean;
  /** Berapa kali percobaan membuka DB gagal — untuk debug, bukan untuk user. */
  attempts: number;
};

export type StorageStatusStore = {
  status: StorageStatus;
  setStatus: (patch: Partial<StorageStatus>) => void;
  resetStatus: () => void;
};

export const INITIAL_STORAGE_STATUS: StorageStatus = {
  phase: "opening",
  reason: null,
  otherTab: false,
  attempts: 0,
};

export const useStorageStatus = create<StorageStatusStore>()((set) => ({
  status: INITIAL_STORAGE_STATUS,
  setStatus: (patch) => set((state) => ({ status: { ...state.status, ...patch } })),
  resetStatus: () => set({ status: INITIAL_STORAGE_STATUS }),
}));

/** Pembaca non-hook (dipakai di dalam action non-React, mis. factory repo). */
export function getStorageStatus(): StorageStatus {
  return useStorageStatus.getState().status;
}

/**
 * Setter non-hook untuk dipakai di dalam factory repo (async, di luar React).
 * Izin baca langsung lewat getStorageStatus().
 */
export function setStatus(patch: Partial<StorageStatus>): void {
  useStorageStatus.getState().setStatus(patch);
}

/** Kembalikan status ke kondisi awal (dipakai test & "Hapus semua data"). */
export function resetStatus(): void {
  useStorageStatus.getState().resetStatus();
}
