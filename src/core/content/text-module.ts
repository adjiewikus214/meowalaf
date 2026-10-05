/**
 * Owner: core/content. Gerbang pemuat modul teks Quran (2,6 MB).
 *
 * Modul ini satu-satunya tempat yang mengimpor `loader.ts` secara DINAMIS. Semua
 * modul lain membacanya lewat sini, supaya teks Quran tidak ikut ter-inline di bundle
 * awal -- lihat docs/PERF.md untuk angka sebelum/sesudah.
 *
 * Kenapa tidak langsung `import { getSurahAyahs } from "./loader"` di layar: Metro
 * menaruh modul yang dipakai &gt;1 route ke chunk `__common`, dan chunk itu dimuat
 * SEBELUM entry jalan. Akibatnya memindahkan kode ke file terpisah tidak cukup; teksnya
 * sendiri harus hanya bisa dimuat lewat dynamic import.
 *
 * Pemakaian yang benar di layar:
 *   const ready = useQuranTextReady();          // hook di features/lessons atau layar
 *   if (!ready) return &lt;Memuat mushaf /&gt;
 *   const ayahs = getReadyQuranText().getSurahAyahs(id);
 *
 * Kegagalan dynamic import = satu-satunya kondisi "gagal": teks tidak bisa dimuat
 * (offline &amp; chunk hilang). Layar harus menampilkan pesan, bukan ayat kosong.
 */

export type QuranTextModule = typeof import("./loader");

export type QuranTextStatus = "idle" | "loading" | "ready" | "failed";

let status: QuranTextStatus = "idle";
let loaded: QuranTextModule | null = null;
let inflight: Promise<QuranTextModule | null> | null = null;

/** Muat modul teks Quran (idempoten: panggilan berikutnya memakai promise yang sama). */
export function ensureQuranText(): Promise<QuranTextModule | null> {
  if (loaded !== null) return Promise.resolve(loaded);
  if (inflight !== null) return inflight;
  status = "loading";
  inflight = import("./loader")
    .then((mod) => {
      loaded = mod;
      status = "ready";
      return mod;
    })
    .catch(() => {
      status = "failed";
      return null;
    });
  return inflight;
}

/** Pemanasan tanpa menunggu (dipanggil saat app sudah tampil). */
export function prefetchQuranText(): void {
  void ensureQuranText();
}

/** Teks sudah siap? Satu-satunya gerbang yang boleh dipakai render ayat. */
export function isQuranTextReady(): boolean {
  return status === "ready" && loaded !== null;
}

/**
 * Modul teks untuk akses sinkron. HANYA panggil setelah `isQuranTextReady()` true;
 * kalau tidak, melempar error — lebih baik gagal keras daripada menampilkan mushaf
 * kosong yang seolah-olah Qurannya memang tidak ada ayat (RULES § 7.3).
 */
export function getReadyQuranText(): QuranTextModule {
  if (loaded === null) {
    throw new Error("Teks Quran belum dimuat — pastikan isQuranTextReady() dicek lebih dulu");
  }
  return loaded;
}

export function getQuranTextStatus(): QuranTextStatus {
  return status;
}

/**
 * Lepaskan hasil gagal supaya `ensureQuranText()` mencoba dynamic import lagi.
 * Dipakai tombol "Coba lagi" -- tanpa ini, status "failed" bersifat permanen karena
 * promise yang gagal sudah tersimpan.
 */
export function resetQuranTextForRetry(): void {
  if (status !== "failed") return;
  status = "idle";
  inflight = null;
}

/** Coba lagi setelah gagal (tombol "Coba lagi" di layar lesson/mushaf). */
export function retryQuranText(): Promise<void> {
  resetQuranTextForRetry();
  return ensureQuranText().then(() => undefined);
}

/** Hanya untuk test: kembalikan modul ke keadaan awal. */
export function resetQuranTextForTest(): void {
  status = "idle";
  loaded = null;
  inflight = null;
}