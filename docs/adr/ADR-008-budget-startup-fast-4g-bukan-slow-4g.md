# ADR-008 — Budget startup pindah ke Fast 4G + first paint, bukan Slow 4G < 2 s

> **Status**: Diterima · **Tanggal**: 2026-10-03 · **Konteks**: Phase 3, budget
> startup [RULES.md](../RULES.md) § 9 yang sejak awal tidak pernah bisa dicapai di
> link lambat. Semua angka: [PERF.md](../PERF.md).
> Referensi: [ADR-007](ADR-007-muat-teks-quran-sebagai-chunk-terpisah.md) (pemecahan
> chunk yang membuat angka ini turun drastis, tapi tidak sampai ke 2 detik).

## Konteks

§ 9 sejak awal menulis satu baris: "Startup app -> Home interaktif (web, 4G
throttled) < 2.0s". Angka "4G throttled" saat itu tidak pernah didefinisikan, jadi
tidak ada yang bisa diuji atau diulang — dan ketika link throttled sungguhan
dibuat (`scripts/perf-budget.mjs`), baris itu langsung gagal jauh.

Setelah ADR-007 dan subset font, angkanya sudah turun drastis: 52,0 s -> 10,0 s
di Slow 4G, 9,7 s -> 4,1 s di Fast 4G. Tapi target 2,0 s tetap gagal, dan bukan
karena masih ada yang bisa dipangkas sembarangan.

Pertanyaan yang harus dijawab: **apakah 2,0 s itu mungkin sama sekali** untuk stack
web sekarang, atau kita sedang mengukur target yang salah?

## Bukti

Empat sample per profil, satu per satu (`--link=` per profil, karena run berurutan
mengotamasi profil terakhir), link throttled sungguhan, gzip seperti CDN:

| Profil link | First contentful paint | Startup -> Home interaktif | Lesson -> interaktif |
|---|---|---|---|
| Slow 4G (150 ms RTT, 1,6 Mbps) | 8,60–8,77 s | 10,01–10,54 s | 10,42 s |
| Fast 4G (9 ms RTT, 9,2 Mbps) | 2,45–2,52 s | 4,02–4,19 s | 1,43–1,47 s |
| localhost (tanpa throttle) | 1,89 s | 1,19–2,42 s | 0,37–3,67 s |

Dan hitungan mentahnya:

- Byte yang benar-benar turun sebelum Home tampil di Slow 4G: **0,92 MB**.
- 0,92 MB pada 200 KB/s = **4,6 detik** hanya transfer, belum parse, belum render.
- Target 2,0 s menuntut **<= 400 KB** sebelum Home, artinya 57 % byte harus hilang
  dari jalur startup.

## Keputusan

**Slow 4G tidak lagi punya budget waktu. Yang ada:**

| Metrik | Profil link | Budget | Alasan angka ini |
|---|---|---|---|
| First contentful paint | Slow 4G | < 10,0 s | 8,6–8,8 s terukur; headroom 15 % |
| Startup -> Home interaktif | Fast 4G | < 5,0 s | 4,0–4,2 s terukur; headroom 20 % |
| Lesson -> interaktif | Fast 4G | < 2,0 s | 1,43–1,47 s terukur; headroom 30 % |
| Bundle web (gzip) | - | < 3 MB | 1,98 MB terukur; 8 MB dulu tidak menangkap apa pun |

Tiga keputusan yang menyertainya:

1. **First paint dipasang di link lambat, startup interaktif di link cepat.** Itu
   bukan pembagian asal: FCP adalah satu-satunya metrik yang masih bermakna di
   link lambat (jaring pengaman — kalau nanti ada yang benar-benar meledak,
   angka ini yang akan menangkap lebih dulu), sedangkan startup interaktif hanya
   bermakna di link yang memang dipakai mayoritas user. Menaruh keduanya di link
   lambat akan membuat FCP jadi pseudo-budget: di link lambat FCP 8,6 s vs Home
   10,0 s — jadi "memenuhi target" di sini cuma membohongi urutan antrean.
2. **Setiap metrik waktu hanya diberi verdict di profilnya.** Angka profil lain
   tetap dihitung dan ditampilkan (Slow 4G startup akan tetap terbaca 10,0 s
   setiap run), tapi tanpa LULUS/GAGAL supaya tidak ada yang memetiknya sebagai
   alasan "lolos". Ini diterapkan di `scripts/perf-budget.mjs` (`BUDGET.startup`,
   `.firstPaint`, `.lesson` masing-masing punya `profile`).
3. **Budget byte diperketat 8 MB -> 3 MB.** Begitu budget waktu di link lambat
   dilepas, byte jadi penjaga tunggal: tidak ada cara membuat waktu membaik
   tanpa byte turun, sedangkan byte bisa naik tanpa langsung terlihat di satu
   metrik waktu.

## Kenapa Slow 4G < 2 detik tidak bisa dicapai (dan kenapa first paint tidak menolong)

1. **Transfer saja sudah melewati target.** 0,92 MB pada 200 KB/s = 4,6 detik,
   dengan asumsi gratis parse dan render yang keduanya nyata.
2. **First paint tidak lebih cepat secara bermakna.** Layar splash kosong sampai
   font + SQLite siap, jadi tidak ada yang bisa dicatat lebih awal: FCP 8,6 s.
   Memindahkan target ke "tampilan pertama" hanya memindahkan ambang, bukan
   memperbaiki app.
3. **Isi 0,92 MB bukan bytecode sembarangan.** `__common` 0,29 MB (zod + UI
   bersama), wasm SQLite, font 0,14 MB, sisanya entry. Yang murah dipangkas:
   `__common` dan `Ionicons.ttf` (lever berikutnya di PERF.md). SQLite **tidak**
   bisa keluar dari jalur splash tanpa keputusan produk, karena PRD § 5.7 melarang
   Home tampil dengan angka 0 lalu melonkat.
4. **Jadi ini keputusan arsitektur, bukan optimasi.** 2,0 s di Slow 4G butuh
   shell web lain: static rendering (prerender HTML Home) atau app shell tanpa
   SQLite di web (IndexedDB). Keduanya bertabrakan dengan offline-first ADR-004
   dan menambah kompleksitas nyata — keduanya di luar v1.

## Konsekuensi

- `docs/RULES.md` § 9 memakai tabel baru di atas; § 9 juga memuat hitungan
  "kenapa tidak ada lagi 2,0 s" supaya jawabannya tidak hilang bersama dokumen.
- `scripts/perf-budget.mjs` menegakkan per-profil; run harian sekarang melaporkan
  LULUS untuk startup Fast 4G dan first paint Slow 4G, sementara Slow 4G startup
  tetap terbaca sebagai informasi.
- Native tidak tersentuh: budget ini selalu soal web. Font dan bundle di APK/iOS
  ikut diuntungkan oleh subset font, tapi tidak ada metrik native di § 9.
- Bundle terukur 1,98 MB (budget 3 MB), jadi ada ruang ~1 MB untuk fitur Phase 3
  berikutnya sebelum budget byte yang jadi penjaga utama mulai berteriak.

## Yang akan membuka keputusan ini lagi

- Shell web berubah: static rendering Home, atau IndexedDB menggantikan SQLite
  di web. Kalau salah satu terjadi, hitung ulang budget dari pengukuran baru —
  jangan mewarisi angka di dokumen ini.
- Baseline berubah drastis, misalnya Hermes dengan bytecode yang sudah dikompilasi,
  atau bundler yang berhasil memotong `__common` jadi separuh.
- Budget 3 MB terlampaui karena fitur baru. Saat itu pilihannya bukan menaikkan
  angka diam-diam, tapi mencatat trade-off di ADR baru.