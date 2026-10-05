/**
 * Test core/content/text-module — gerbang pemuat chunk teks Quran.
 *
 * Kontrak yang diuji di sini adalah yang dipakai layar lesson & mushaf: ayat
 * boleh dirender HANYA setelah `isQuranTextReady()`, dan `getReadyQuranText()` lebih
 * baik melempar daripada diam-diam mengembalikan modul yang belum ada (RULES § 7.3).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ensureQuranText,
  getQuranTextStatus,
  getReadyQuranText,
  isQuranTextReady,
  prefetchQuranText,
  resetQuranTextForRetry,
  resetQuranTextForTest,
} from "./text-module";

describe("gerbang teks Quran", () => {
  beforeEach(() => {
    resetQuranTextForTest();
  });

  it("sebelum dimuat: status idle, belum siap", () => {
    expect(getQuranTextStatus()).toBe("idle");
    expect(isQuranTextReady()).toBe(false);
  });

  it("getReadyQuranText() melempar kalau belum siap — bukan teks kosong", () => {
    expect(() => getReadyQuranText()).toThrow(/belum dimuat/);
  });

  it("ensureQuranText() memuat modul dan ayatnya bisa dibaca", async () => {
    const mod = await ensureQuranText();
    expect(mod).not.toBeNull();
    expect(isQuranTextReady()).toBe(true);
    expect(getQuranTextStatus()).toBe("ready");
    expect(getReadyQuranText().getSurahAyahs(1)).toHaveLength(7);
  });

  it("dipanggil berkali-kali -> satu modul yang sama, bukan import ulang", async () => {
    const first = await ensureQuranText();
    const second = await ensureQuranText();
    expect(second).toBe(first);
  });

  it("prefetchQuranText() tidak melempar dan menyiapkan modul", async () => {
    prefetchQuranText();
    await vi.waitFor(() => {
      expect(isQuranTextReady()).toBe(true);
    });
  });

  it("retry tidak menghapus modul yang sudah siap", async () => {
    await ensureQuranText();
    resetQuranTextForRetry();
    expect(isQuranTextReady()).toBe(true);
    expect(getReadyQuranText().getSurahAyahs(2).length).toBeGreaterThan(0);
  });
});