/**
 * Test untuk keputusan "Home boleh tampil sebelum SQLite selesai" (ADR-009).
 *
 * Dua hal yang diuji di sini adalah tempat sebenarnya dari risiko ini:
 *   1. `shouldRevealShell` - kapan splash boleh dilepas.
 *   2. `isProgressLoading` - kapan angka progres WAJIB disembunyikan.
 *
 * Yang kedua lebih penting: kalau salah, Home menampilkan "0" sebagai fakta.
 */
import { afterEach, describe, expect, it } from "vitest";

import { SPLASH_GRACE_MS, shouldRevealShell, splashTickerDone } from "./hydration";
import {
  isProgressLoading,
  isProgressTrusted,
  resetHydrationForTest,
  setHydrationPhase,
  useHydrationStore,
} from "./hydration-store";

afterEach(() => {
  resetHydrationForTest();
});

describe("shouldRevealShell (kapan splash dilepas)", () => {
  const base = { fontsReady: true, hydrated: true, elapsedSinceFontsMs: 0 };

  it("font belum siap: shell tidak tampil apa pun yang lain", () => {
    expect(shouldRevealShell({ ...base, fontsReady: false })).toBe(false);
    // Bahkan setelah grace jauh berlampau: tanpa font, halaman akan melompat
    // layout saat font tiba, jadi menahannya lebih baik daripada flicker.
    expect(
      shouldRevealShell({ ...base, fontsReady: false, elapsedSinceFontsMs: 99_999 }),
    ).toBe(false);
  });

  it("hydrasi selesai: shell langsung tampil, tanpa perlu grace", () => {
    expect(shouldRevealShell(base)).toBe(true);
  });

  it("hydrasi lambat: grace menahan splash sebentar, lalu shell tetap tampil", () => {
    const slow = { fontsReady: true, hydrated: false };
    expect(shouldRevealShell({ ...slow, elapsedSinceFontsMs: 0 })).toBe(false);
    expect(shouldRevealShell({ ...slow, elapsedSinceFontsMs: SPLASH_GRACE_MS - 1 })).toBe(false);
    expect(shouldRevealShell({ ...slow, elapsedSinceFontsMs: SPLASH_GRACE_MS })).toBe(true);
    expect(shouldRevealShell({ ...slow, elapsedSinceFontsMs: 60_000 })).toBe(true);
  });

  it("grace tidak boleh menunda splash lebih dari 500 ms", () => {
    // Angka ini keputusan produk (bukan sekadar konstanta teknis): inilah batas
    // jeda yang maximal sebelum Home tampil dengan placeholder. Naikkan berarti
    // user menatap splash lebih lama tanpa dapat apa-apa.
    expect(SPLASH_GRACE_MS).toBeLessThanOrEqual(500);
  });

  it("ticker splash berhenti tepat setelah grace habis, bukan menyala selamanya", () => {
    // Ticker 100 ms yang dibiarkan hidup = root layout re-render 10×/detik terus
    // menerus, dan layar (termasuk animasi sekali-jalan di dalamnya) ikut
    // di-render ulang. Tidak ada yang membaca angkanya lagi setelah grace.
    expect(splashTickerDone(0)).toBe(false);
    expect(splashTickerDone(SPLASH_GRACE_MS - 1)).toBe(false);
    expect(splashTickerDone(SPLASH_GRACE_MS)).toBe(true);
    expect(splashTickerDone(60_000)).toBe(true);
  });
});

describe("isProgressLoading (angka progres belum boleh tampil)", () => {
  it("selama boot dan store belum hydrate: WAJIB placeholder", () => {
    expect(isProgressLoading("loading", "idle")).toBe(true);
    expect(isProgressLoading("loading", "hydrating")).toBe(true);
  });

  it("begitu store hydrate, angka tampil walau fase boot belum selesai", () => {
    // `status` store progres adalah penanda yang paling dekat dengan datanya,
    // jadi tidak perlu menunggu penanda kasar yang lain.
    expect(isProgressLoading("loading", "ready")).toBe(false);
  });

  it("fase timeout diperlakukan sebagai boleh tampil (app harus bisa dipakai)", () => {
    expect(isProgressLoading("timeout", "idle")).toBe(false);
    expect(isProgressLoading("timeout", "hydrating")).toBe(false);
    expect(isProgressTrusted("timeout")).toBe(true);
    expect(isProgressTrusted("ready")).toBe(true);
    expect(isProgressTrusted("loading")).toBe(false);
  });

  it("fase ready selalu dipercaya, apa pun status store", () => {
    expect(isProgressLoading("ready", "idle")).toBe(false);
  });
});

describe("store fase hydration", () => {
  it("default loading, dan bisa diubah tanpa React", () => {
    expect(useHydrationStore.getState().phase).toBe("loading");
    setHydrationPhase("ready");
    expect(useHydrationStore.getState().phase).toBe("ready");
    resetHydrationForTest();
    expect(useHydrationStore.getState().phase).toBe("loading");
  });
});