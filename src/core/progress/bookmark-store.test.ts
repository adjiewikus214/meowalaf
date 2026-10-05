import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryProgressRepo } from "../db/progress-repo";
import { applyToggle, bookmarkKey, isBookmarked, useBookmarkStore } from "./bookmark-store";

const state = () => useBookmarkStore.getState();

beforeEach(() => {
  state().resetAll();
});

describe("applyToggle() — aturan murni tambah/hapus", () => {
  it("menambah ayat yang belum ada", () => {
    const next = applyToggle([], 2, 255, "2026-10-04T00:00:00.000Z");
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ surahId: 2, ayahNumber: 255 });
  });

  it("menghapus ayat yang sudah ada", () => {
    const saved = applyToggle([], 2, 255, "2026-10-04T00:00:00.000Z");
    expect(applyToggle(saved, 2, 255, "2026-10-04T00:00:01.000Z")).toEqual([]);
  });

  it("toggle dua kali kembali ke keadaan awal", () => {
    const once = applyToggle([], 36, 1, "2026-10-04T00:00:00.000Z");
    expect(applyToggle(once, 36, 1, "2026-10-04T00:00:01.000Z")).toEqual([]);
  });

  it("urutan selalu surah:ayat, bukan urutan ketukan", () => {
    let list = applyToggle([], 114, 1, "t1");
    list = applyToggle(list, 2, 1, "t2");
    list = applyToggle(list, 2, 255, "t3");
    expect(list.map((b) => bookmarkKey(b.surahId, b.ayahNumber))).toEqual([
      "2:1",
      "2:255",
      "114:1",
    ]);
  });

  it("ayat dengan nomor sama di surah berbeda TIDAK saling menimpa", () => {
    // Ini bugs yang paling mungkin: tanpa composite key, "1:1" menimpa "2:1".
    const list = applyToggle([], 1, 1, "t1");
    const two = applyToggle(list, 2, 1, "t2");
    expect(two).toHaveLength(2);
    expect(isBookmarked(two, 1, 1)).toBe(true);
    expect(isBookmarked(two, 2, 1)).toBe(true);
  });
});

describe("isBookmarked()", () => {
  it("hanya ayat yang benar-benar ada", () => {
    const list = applyToggle([], 36, 82, "t1");
    expect(isBookmarked(list, 36, 82)).toBe(true);
    expect(isBookmarked(list, 36, 83)).toBe(false);
    expect(isBookmarked(list, 37, 82)).toBe(false);
  });
});

describe("store + repo", () => {
  it("toggle tersimpan di repo dan terbaca balik setelah reload state", async () => {
    const repo = new InMemoryProgressRepo();
    await repo.migrate();
    state().setRepo(repo);

    expect(await state().toggle(36, 82)).toBe(true);
    expect(await repo.getBookmarks()).toHaveLength(1);

    state().resetAll();
    await state().load();
    expect(state().bookmarks).toHaveLength(1);
    expect(state().loaded).toBe(true);
  });

  it("toggling ayat yang sama dua kali menghapus, dan repo ikut kosong", async () => {
    const repo = new InMemoryProgressRepo();
    await repo.migrate();
    state().setRepo(repo);

    await state().toggle(2, 255);
    expect(await state().toggle(2, 255)).toBe(false);
    expect(await repo.getBookmarks()).toHaveLength(0);
    expect(state().bookmarks).toHaveLength(0);
  });

  it("menambah ayat yang sudah ada tidak menduplikasi", async () => {
    const repo = new InMemoryProgressRepo();
    await repo.migrate();
    state().setRepo(repo);

    await state().toggle(1, 7);
    await state().toggle(1, 7); // kebetulan saklar balik = hapus
    await state().toggle(1, 7);
    // Repo dipanggil langsung supaya bypass saklar store.
    await repo.addBookmark(1, 7);
    expect(await repo.getBookmarks()).toHaveLength(1);
  });

  it("repo gagal → daftar dikembalikan, jangan tampilkan bookmark palsu", async () => {
    // Optimisme tanpa rollback berarti user melihat "tersimpan" untuk ayat yang
    // akan hilang begitu app ditutup — lebih buruk dari tidak ada feedback.
    const broken = {
      migrate: () => Promise.resolve(),
      getProgressDay: () => Promise.reject(new Error("x")),
      getLatestProgressDayUpTo: () => Promise.reject(new Error("x")),
      saveProgressDay: () => Promise.reject(new Error("x")),
      recordLessonSession: () => Promise.reject(new Error("x")),
      getLessonsByDay: () => Promise.reject(new Error("x")),
      getAllLessons: () => Promise.reject(new Error("x")),
      recordBonusXp: () => Promise.reject(new Error("x")),
      getBonusXpByDay: () => Promise.reject(new Error("x")),
      getAllBonusXp: () => Promise.reject(new Error("x")),
      getBookmarks: () => Promise.reject(new Error("x")),
      addBookmark: () => Promise.reject(new Error("db rusak")),
      removeBookmark: () => Promise.reject(new Error("db rusak")),
      clearAll: () => Promise.reject(new Error("x")),
    };
    state().setRepo(broken);

    expect(await state().toggle(36, 82)).toBe(false);
    expect(state().bookmarks).toEqual([]);
  });

  it("tanpa repo (belum hydrate) tidak ada bookmark palsu", async () => {
    // Repo aktif ada di variabel modul dan bertahan antar test, jadi
    // pastikan store benar-benar tidak punya repo saat test ini jalan.
    const repo = new InMemoryProgressRepo();
    await repo.migrate();
    state().setRepo(repo);
    await state().toggle(36, 82);
    state().resetAll();
    state().setRepo(null as never); // simulasi hydrate belum selesai

    expect(await state().toggle(36, 1)).toBe(false);
    expect(state().bookmarks).toEqual([]);
  });

  it("resetAll mengosongkan daftar (hapus semua data, RULES § 8)", async () => {
    const repo = new InMemoryProgressRepo();
    await repo.migrate();
    state().setRepo(repo);
    await state().toggle(1, 1);
    state().resetAll();
    expect(state().bookmarks).toEqual([]);
    expect(state().loaded).toBe(true);
  });
});
