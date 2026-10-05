# ADR-007 — Teks Quran dimuat sebagai chunk terpisah (bukan inline di bundle awal)

> **Status**: Diterima · **Tanggal**: 2026-10-03 · **Konteks**: Phase 3, perbaikan
> budget startup (RULES § 9) yang gagal diukur di [PERF.md](../PERF.md)
> Referensi: [ADR-004](ADR-004-bundle-konten-penuh.md) — keputusan ini DAMPAKNYA
> sebagian poin "static import", bukan membatalkan ADR-004.

## Konteks

ADR-004 memilih bundling penuh supaya app offline-first dan tanpa state "surah belum
terunduh". faresanya sederhana: file JSON ikut build, offline certainty tinggi.
Yang tidak dipertimbangkan adalah bahwa "bundle penuh" di web berarti **2,6 MB teks ikut
di-parse sebelum layar pertama tampil**.

Terukur 3 Okt 2026 (server gzip, link throttled sungguhan):

| Yang diukur | Sebelum | Sesudah |
|---|---|---|
| Bundle web total (gzip) | 4,14 MB | 2,27 MB |
| Entry chunk yang dimuat sebelum Home | 8,5 MB mentah / 1,39 MB gzip | 1,08 MB mentah / 0,28 MB gzip |
| Startup → Home, Slow 4G (150 ms RTT, 1,6 Mbps) | 52,0 s\* | 18,3 s\* |
| Startup → Home, Fast 4G | 9,7 s\* | 6,6 s\* |

\* Angka "sebelum" diukur dengan server yang mengirim berkas **mentah** dan throttle
per-koneksi; keduanya sudah diperbaiki di `scripts/perf-budget.mjs` (lihat PERF.md).
Perbandingan fair harus membandingkan "sebelum versi harness yang sama" — angka itu
diukur ulang di bawah pada bagian Konsekuensi.

Tiga pemboros yang terukur, semuanya di jalur startup:

1. Tujuh family font ikon `@expo/vector-icons` ter-bundle padahal app memakai 4 glyph.
2. Teks Quran ter-inline di entry chunk.
3. Satu berkas entry 8,5 MB = 34% bundle.

## Keputusan

- **Satu titik import ikon** (`src/ui/icons.ts`) memakai deep import
  `@expo/vector-icons/Ionicons`, sehingga hanya satu font ikon (.ttf) ikut bundle.
  Family lain hanya boleh ditambahkan di sana dengan sengaja.
- **Metadata konten dipisah dari teks**: `src/core/content/meta.ts` (114 metadata
  surah, daftar qari, manifest — ~24 KB) tetap static import; `src/core/content/loader.ts`
  (teks Uthmani + terjemahan) HANYA boleh dimuat lewat dynamic import dari
  `src/core/content/text-module.ts`.
- **Route di-split** lewat `expo-router` asyncRoutes (web only, `app.json`
  `plugins: [["expo-router", {"asyncRoutes": {"web": "production"}}]]` +
  `extra.router.asyncRoutes`), supaya Home/tab tidak menarik modul layar lesson.
- **Prefetch setelah layar pertama tampil**: root layout memanggil `prefetchQuranText()`
  saat browser idle, supaya saat user menekan "Lanjut Ngaji" chunk-nya sudah ada.
- **Modul pure tidak boleh meng-import modul teks.** Generator soal dan panel materi
  membaca ayat lewat registry `src/core/content/ayah-source.ts`, yang diisi modul teks
  saat dimuat. Layar WAJIB mengecek `isQuranTextReady()` sebelum merender ayat
  (RULES § 7.3: tidak boleh tampil setengah jadi, dan tidak boleh salah terlihat
  "surah ini memang tidak ada ayat").

## Konsekuensi

- (+) Entry chunk turun dari 8,5 MB ke 1,08 MB mentah; Home tidak lagi menunggu teks
  Quran, wa-parse, atau font ikon yang tidak dipakai.
- (+) Bundle web total turun 4,14 MB → 2,27 MB gzip.
- (−) Di **web**, kunjungan pertama butuh jaringan untuk chunk teks (~0,67 MB gzip),
  sama seperti butuh jaringan untuk JS-nya sendiri. Kunjungan berikutnya dilayani
  cache browser (URL ber-hash + `Cache-Control: immutable` di `vercel.json`).
  **Native tidak terpengaruh**: Metro tetap menyertakan teks di dalam binary, jadi
  offline-first penuh tetap berlaku untuk APK/iOS.
- (−) Dua kondisi UI baru yang harus ditangani jujur: "memuat mushaf..." dan
  "teks Quran gagal dimuat" + tombol coba lagi. Ini bukan kebocoran — kebijakan
  fail-soft yang sama dengan audio ngambek (PRD § 5.4).
- (−) Tiga modul baru + aturan baru untuk contributor baru: teks Quran hanya boleh
  di-import lewat `text-module.ts`. Pelanggaran aturan ini diam-diam membalikkan
  perbaikan ini, jadi aturan ini juga ditutup test (`src/core/content/*.test.ts`).

## Yang TIDAK dilakukan (sengaja)

- **Tidak memindahkan teks ke asset yang di-fetch terpisah** (JSON + service worker).
  Itu membalik offline-first dan menambah status "belum terunduh" di mana-mana;
  chunk Metro memberi sebagian besar keuntungan tanpa itu.
- **Tidak menunda font Amiri ke idle.** Home memang menampilkan nama Arab surat,
  jadi menundanya akan memunculkan FOUT yang terlihat di layar pertama.
- **Tidak menggeser SQLite (wasm 0,29 MB gzip) keluar dari splash.** Itu akan membuat
  Home tampil lebih dulu dengan angka 0 lalu meloncat — keputusan produk, bukan
  keputusan teknis. Lihat "Sisa pekerjaan" di PERF.md.