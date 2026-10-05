/**
 * Owner: core/content. Sumber data ayat yang bisa diganti (registry injection).
 *
 * Kenapa modul ini ada: teks Quran ~2,6 MB mentah TIDAK boleh ikut ter-bundle di jalur
 * startup (lihat docs/PERF.md). Modul beratnya (`loader.ts`) hanya boleh dimuat lewat
 * dynamic import, tapi banyak modul PURE (generator soal, panel materi) butuh
 * `getSurahAyahs` secara sinkron dan tidak boleh mengimpor modul berat itu langsung --
 * kalau mereka mengimpornya, Metro menarik 2,6 MB itu ke chunk yang selalu dimuat.
 *
 * Solusinya: modul berat mendaftarkan dirinya sendiri di sini saat dimuat, dan modul
 * pure membaca lewat `surahAyahs()`. Test cukup mengimpor `loader.ts` (atau lewat
 * setup file) untuk mendaftarkan sumbernya, sama seperti app sungguhan.
 *
 * Kontrak: `surahAyahs()` mengembalikan array KOSONG kalau sumber belum terdaftar.
 * Itu bukan "surah kosong" yang boleh lolos diam-diam (RULES § 7.3) -- pemanggil wajib
 * mengecek `isAyahSourceReady()` lebih dulu. `hooks.ts` dan layar mushaf melakukannya.
 */
import type { AyahContent } from "./meta";

export type AyahSource = (surahId: number) => readonly AyahContent[];

let source: AyahSource | null = null;

/** Dipanggil modul berat (loader.ts) sekali saat dimuat. */
export function registerAyahSource(next: AyahSource): void {
  source = next;
}

/** Sumber ayat sudah dimuat? Layar WAJIB cek ini sebelum render ayat. */
export function isAyahSourceReady(): boolean {
  return source !== null;
}

/** Ayat-ayat satu surah; array kosong kalau sumber belum dimuat. */
export function surahAyahs(surahId: number): AyahContent[] {
  return source === null ? [] : [...source(surahId)];
}

/** Hanya untuk test: lepaskan sumber yang terdaftar. */
export function resetAyahSourceForTest(): void {
  source = null;
}