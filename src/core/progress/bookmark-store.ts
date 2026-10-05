/**
 * Owner: core/progress. Bookmark favorit ayat — daftar ayat yang user menandai
 * sendiri, berbeda dari `reading.lastRead` yang otomatis mengikuti posisi baca.
 *
 * Kenapa store sendiri dan bukan tempel di lesson-store: satu owner per state
 * (RULES § 4) dan lesson-store sudah khusus lesson/gamifikasi. Repo tetap satu
 * (`setRepo` dipanggil dari hydration, jalur yang sama dengan lesson-store)
 * supaya tidak ada dua writers SQLite yang saling menimpa.
 *
 * Data TIDAK append-only (user memang menghapus bookmark), jadi berbeda dari
 * lesson_log/answer_log/xp_ledger — lihat catatan migration v3.
 *
 * Optimisme: toggle lebih dulu mengubah daftar lokal berubah, lalu results repo. Kalau DB gagal,
 * daftar dikembalikan ke keadaan semula supaya layar tidak berbohong tentang
 * apa yang tersimpan.
 */
import { create } from "zustand";

import type { AyahBookmark, ProgressRepo } from "../db/progress-repo";

export type BookmarkState = {
  /** Daftar tersimpan, urut surah:ayat (dipakai apa adanya dari repo). */
  bookmarks: AyahBookmark[];
  /** Repo belum siap / gagal baca — UI wait tidak menampilkan "tersimpan: 0". */
  loaded: boolean;
  setRepo: (repo: ProgressRepo) => void;
  /** Muat daftar dari storage (dipanggil saat hydrate & upgrade). */
  load: () => Promise<void>;
  /** Tambah/hapus satu ayat; kembalikan true kalau sekarang tersimpan. */
  toggle: (surahId: number, ayahNumber: number) => Promise<boolean>;
  resetAll: () => void;
};

/** Repo aktif — hanya diisi lewat `setRepo` (hydrasi), bukan dari komponen. */
let activeRepo: ProgressRepo | null = null;

/** Kunci stabil untuk set membership — "36:1" lebih cepat & jelas dari join tuple. */
export function bookmarkKey(surahId: number, ayahNumber: number): string {
  return `${surahId}:${ayahNumber}`;
}

/**
 * Terapkan toggle pada daftar — PURE, jadi aturan "tambah kalau belum ada,
 * hapus kalau sudah ada" bisa diuji tanpa repo.
 */
export function applyToggle(
  bookmarks: readonly AyahBookmark[],
  surahId: number,
  ayahNumber: number,
  createdAt: string,
): AyahBookmark[] {
  const key = bookmarkKey(surahId, ayahNumber);
  const exists = bookmarks.some((b) => bookmarkKey(b.surahId, b.ayahNumber) === key);
  if (exists) return bookmarks.filter((b) => bookmarkKey(b.surahId, b.ayahNumber) !== key);
  return [...bookmarks, { surahId, ayahNumber, createdAt }].sort(
    (a, b) => a.surahId - b.surahId || a.ayahNumber - b.ayahNumber,
  );
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarks: [],
  loaded: false,

  setRepo: (repo) => {
    activeRepo = repo;
  },

  load: async () => {
    const repo = activeRepo;
    if (repo === null) return; // repo belum siap -> tetap "belum tahu", bukan kosong
    try {
      set({ bookmarks: await repo.getBookmarks(), loaded: true });
    } catch (error) {
      console.warn("[bookmark] load gagal:", error instanceof Error ? error.message : String(error));
    }
  },

  toggle: async (surahId, ayahNumber) => {
    const before = get().bookmarks;
    const wasSaved = before.some((b) => b.surahId === surahId && b.ayahNumber === ayahNumber);
    // Optimis dulu supaya ketukan terasa instan; di bawah ini dikoreksi kalau
    // storage tidak mengiyakan.
    set({ bookmarks: applyToggle(before, surahId, ayahNumber, new Date().toISOString()) });

    const repo = activeRepo;
    if (repo === null) {
      // Tanpa storage: kembalikan keadaan, jangan tampilkan bookmark palsu yang
      // akan hilang begitu app ditutup.
      set({ bookmarks: before });
      return wasSaved;
    }
    try {
      const next = wasSaved
        ? await repo.removeBookmark(surahId, ayahNumber)
        : await repo.addBookmark(surahId, ayahNumber);
      set({ bookmarks: next, loaded: true });
      return !wasSaved;
    } catch (error) {
      console.warn("[bookmark] toggle gagal:", error instanceof Error ? error.message : String(error));
      set({ bookmarks: before });
      return wasSaved;
    }
  },

  resetAll: () => set({ bookmarks: [], loaded: true }),
}));

/** Apakah satu ayat tersimpan — selector murni, aman dipanggil tiap render. */
export function isBookmarked(
  bookmarks: readonly AyahBookmark[],
  surahId: number,
  ayahNumber: number,
): boolean {
  return bookmarks.some((b) => b.surahId === surahId && b.ayahNumber === ayahNumber);
}
