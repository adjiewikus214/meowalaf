/**
 * Owner: core/progress. Boot app: buka penyimpanan progres, hydrate store, dan
 * memutuskan kapan layar pertama boleh tampil.
 *
 * Perubahan penting (ADR-009): dulu modul ini menahan splash sampai SQLite
 * selesai dibuka, jadi angka progres tidak pernah "melompat". Sekarang timeout
 * ini justru yang bikin lambat: 0,29 MB wasm + web worker ikut nunggu di jalur
 * paint. Jadi splash tidak lagi menunggu DB — yang dijamin bukan "tidak ada
 * angka yang belum siap", tapi "angka yang belum siap tidak pernah tampil sebagai
 * angka" (lihat `isProgressLoading` di hydration-store).
 *
 * Boleh di-import app/.
 */
import { useEffect, useRef, useState } from "react";

import { openProgressRepo, upgradeToSqlite } from "../db/open-repo";
import { todayWib } from "../time/wib";
import { setHydrationPhase } from "./hydration-store";
import { useBookmarkStore } from "./bookmark-store";
import { useProgressEventsStore } from "./lesson-store";
import { useProfileStore } from "./store";

/** Seberapa sering tab yang tertahan mencoba naik lagi ke SQLite. */
const UPGRADE_INTERVAL_MS = 5000;
import { useReadingStore } from "./reading";

/**
 * Batas waktu keamanan: kalau DB tidak juga selesai, lepaskan splash dan
 * biarkan app jalan (dengan banner jujur soal penyimpanan). Nilai ini bukan
 * target performa, cuma jaring pengaman terhadap splash yang mandek.
 */
export const HYDRATION_SAFETY_MS = 3000;

/**
 * Berapa lama splash boleh menunggu setelah font siap, sebelum layar pertama
 * ditampilkan dengan placeholder.
 *
 * Kenapa bukan 0: di jaringan cepat SQLite selesai dalam ~100-200 ms, jadi
 * grace ini membuat mayoritas user TIDAK PERNAH melihat skeleton - splash
 * dilepas seperti biasa. Di jaringan lambat grace ini habis, shell tampil, dan
 * wasm SQLite + worker boleh selesai diunduh di belakang layar.
 */
export const SPLASH_GRACE_MS = 500;

/**
 * Keputusan politiknya, ditulis murni supaya bisa dites tanpa React: tampilkan
 * shell kalau font sudah siap DAN (hydrasi sudah selesai ATAU grace habis).
 * Sebelumnya aturan ini inline di root layout dan tidak bisa diuji - padahal
 * kasus yang paling penting justru ini: hydration lambat, app tetap harus tampil.
 */
export function shouldRevealShell(input: {
  fontsReady: boolean;
  hydrated: boolean;
  elapsedSinceFontsMs: number;
}): boolean {
  if (!input.fontsReady) return false;
  if (input.hydrated) return true;
  return input.elapsedSinceFontsMs >= SPLASH_GRACE_MS;
}

/**
 * Ticker splash boleh berhenti begitu keputusan reveal sudah final.
 *
 * `elapsedSinceFontsMs` tidak dibaca siapa pun setelah grace habis. Interval
 * 100 ms yang dibiarkan hidup membuat root layout re-render **10×/detik
 * selamanya** — cukup untuk membuat layar (dan animasi sekali-jalan di
 * dalamnya, mis. maskot yang berjalan masuk) di-render ulang berkali-kali di
 * tab yang timer-nya di-throttle. Jadi berhenti, bukan jalan terus.
 */
export function splashTickerDone(elapsedSinceFontsMs: number): boolean {
  return elapsedSinceFontsMs >= SPLASH_GRACE_MS;
}

/**
 * Hitung `{ reveal, elapsedSinceFontsMs }` untuk dipakai root layout.
 * Mulai menghitung dari saat font siap, bukan dari mount, supaya timer tidak
 * hangus saat font yang lambat.
 *
 * `waitForHydration` = apakah splash boleh menunggu DB selesai. Di native: ya
 * (SQLite lokal, tidak ada biaya unduhan, jadi tidak alasan menunda). Di web:
 * TIDAK - lihat `usePersistentHydration(startWhen)`.
 */
export function useSplashReveal(fontsReady: boolean, waitForHydration: boolean): {
  reveal: boolean;
  elapsedSinceFontsMs: number;
} {
  const [elapsedSinceFontsMs, setElapsedSinceFontsMs] = useState(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!fontsReady) {
      startedAt.current = null;
      setElapsedSinceFontsMs(0);
      return;
    }
    startedAt.current = Date.now();
    setElapsedSinceFontsMs(0);
    const id = setInterval(() => {
      if (startedAt.current === null) return;
      const elapsed = Date.now() - startedAt.current;
      setElapsedSinceFontsMs(elapsed);
      if (splashTickerDone(elapsed)) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [fontsReady]);

  return {
    reveal: shouldRevealShell({ fontsReady, hydrated: !waitForHydration, elapsedSinceFontsMs }),
    elapsedSinceFontsMs,
  };
}

/**
 * `startWhen` = boleh mulai membuka penyimpanan.
 *
 * Kenapa bukan langsung: di web, membuka DB berarti mengunduh wasm SQLite
 * (0,29 MB) + web worker. Kalau itu dimulai saat mount, unduhan itu berebut
 * pipa yang sama dengan entry chunk, `__common`, dan font yang justru
 * dibutuhkan untuk paint pertama - jadi "SQLite tidak lagi di jalur splash"
 * hanya benar di atas kertas, sementara di kabel ia masih di depan. Dimulai
 * setelah shell tampil, byte itu turun bersamaan dengan user sudah membaca
 * Home, dan tidak lagi menunda frame pertama.
 *
 * Di native tidak ada unduhan seperti itu, jadi pemanggilnya tetap `true`
 * dari awal dan perilaku splash native tidak berubah.
 */
export function usePersistentHydration(startWhen: boolean): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!startWhen) return;
    let alive = true;
    const finish = () => {
      if (alive) setReady(true);
    };
    const timeout = setTimeout(() => {
      // App harus tetap bisa dipakai walau DB tidak pernah selesai dibuka.
      // Fase "timeout" berarti angka progres ditampilkan seperti perilaku lama
      // (bisa jadi 0) - StorageBanner yang menjaga kejujuran itu: kejujuran itu.
      setHydrationPhase("timeout");
      finish();
    }, HYDRATION_SAFETY_MS);
    const run = async () => {
      await Promise.all([useProfileStore.persist.rehydrate(), useReadingStore.persist.rehydrate()]);
      // DB progres: gagal buka -> hydrate store tetap jalan (progres nol hari ini),
      // dan statusnya dipasang lewat storage-status supaya UI bisa memberi tahu.
      const opened = await openProgressRepo();
      useBookmarkStore.getState().setRepo(opened.repo);
      await useProgressEventsStore.getState().hydrate(opened.repo, todayWib());
      // Bookmark ikut repo yang sama (satu writer SQLite). Sengaja TIDAK
      // di-await: daftar di layar mushaf boleh menyusul, dan angka "0
      // bookmark" yang muncul sebelum storage siap sama bohongnya dengan
      // angka progres — daftar itu tampil kosong dengan `loaded: false`.
      void useBookmarkStore.getState().load();

      // Tab ini turun ke in-memory karena tab lain memegang DB. Jangan berhenti di
      // situ: coba naik ke SQLite tiap beberapa detik, dan pindahkan apa yang sudah
      // tercatat selama menunggu supaya tidak ada progres yang hilang diam-diam.
      if (opened.pending !== null) {
        let trying = false;
        const stop = setInterval(() => {
          if (trying || !alive) return;
          trying = true;
          void upgradeToSqlite(opened.pending!)
            .then((up) => {
              if (up === null || !alive) return;
              clearInterval(stop);
              const events = useProgressEventsStore.getState();
              events.setRepo(up.repo);
              useBookmarkStore.getState().setRepo(up.repo);
              void useBookmarkStore.getState().load();
              void events.hydrate(up.repo, todayWib());
            })
            .finally(() => {
              trying = false;
            });
        }, UPGRADE_INTERVAL_MS);
      }
    };
    run()
      .then(() => {
        // hydrate() sudah selesai: angka di store SEKARANG nyata (SQLite atau
        // fallback in-memory, yang mana pun StorageBanner yang menjelaskan).
        setHydrationPhase("ready");
      })
      .catch(() => {
        // Ini bukan "ready" — repo mungkin tidak pernah ter-hydrate. Phase stays
        // loading sehingga layar tetap menampilkan placeholder, bukan angka nol
        // yang diklaim sebagai fakta.
        console.warn("[progress] hydration gagal total; placeholder tetap tampil");
      })
      .finally(() => {
        clearTimeout(timeout);
        finish();
      });
    return () => {
      alive = false;
      clearTimeout(timeout);
    };
  }, [startWhen]);

  return ready;
}