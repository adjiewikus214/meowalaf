# ADR-009 — Di web, Home boleh tampil sebelum SQLite selesai dibuka

> **Status**: Diterima · **Tanggal**: 4 Okt 2026 · **Konteks**: Phase 3, jalur
> paint. Angka: [PERF.md](../PERF.md). Prasyarat: [ADR-007](ADR-007-muat-teks-quran-sebagai-chunk-terpisah.md)
> (teks Quran sebagai chunk terpisah), [ADR-008](ADR-008-budget-startup-fast-4g-bukan-slow-4g.md)
> (budget pindah ke Fast 4G + first paint).

## Konteks

Splash ditahan sampai SQLite selesai dibuka. Alasannya benar dan tidak boleh
dibuang: kalau Home muncul lebih dulu, angka streak/XP tampil sebagai `0` lalu
melonkat jadi angka sebenarnya. `0` itu klaim, bukan "belum tahu" — dan user
melihat lompatan itu di layar yang paling mereka percaya.

Tapi menahan splash berarti **unduhan SQLite ada di jalur paint**. Di web, membuka
DB menarik `wa-sqlite.wasm` 0,29 MB + `worker-*.js`, dan permintaan itu mulai
bersamaan dengan `entry`, `__common`, dan tiga font — semuanya berbagi satu pipa.
Hasilnya terukur sebelum ADR ini: startup Fast 4G 4,02–4,19 s, FCP Slow 4G
8,61–8,77 s, dan 0,92 MB sudah masuk sebelum Home tampil.

Jadi masalahnya bukan "tunggu atau tidak" — tapi "**dimulai kapan**".

## Keputusan

Empat bagian, satu ide: SQLite tidak lagi berada di antara paint dan user.

1. **Di web, splash tidak menunggu SQLite.** Shell dilepas begitu font siap,
   ditambah grace period pendek (`useSplashReveal`) supaya tidak berkedip pada
   perangkat cepat. Di native tidak ada unduhan wasm, jadi splash **tetap**
   menunggu hydration seperti sebelumnya — perilaku ini sengaja tidak diubah.
2. **Pembukaan DB justru DIMULAI setelah shell tampil**, bukan sekadar "tidak
   ditunggu". Ini bagian yang paling penting dan paling mudah salah baca: kalau DB
   tetap mulai saat mount, ia tetap berebut pipa yang sama dan ADR ini hanya
   benar di atas kertas.
3. **Angka progres yang belum termuat jadi placeholder, bukan `0`.**
   `isProgressLoading()` di [hydration-store.ts](../../src/core/progress/hydration-store.ts)
   adalah satu-satunya penentu; Home dan Profil memakainya, tidak menebak sendiri.
   Placeholder memakai slot berukuran sama, supaya tidak ada lompatan layout.
4. **"Lanjut Ngaji" disabled sampai repo siap.** Tombol yang bisa ditekan
   berarti progres dijamin bisa disimpan. Itulah syaratnya, dan itu juga alasan
   angka progres tidak boleh tampil sebelum repo siap.

Yang **tidak** ikut di-skeleton: angka quest — itu AsyncStorage, nilainya benar
sejak awal. Memberi placeholder di sana akan berbohong soal state yang sudah diketahui.

## Konsekuensi (terukur)

| Metrik | Sebelum | Sesudah |
|---|---|---|
| Startup → Home, Fast 4G | 4,02–4,19 s | **2,05–3,62 s** |
| FCP, Slow 4G | 8,61–8,77 s | **7,52–8,23 s** |
| Startup → Home, Slow 4G | 10,01–10,54 s | **9,04–11,21 s** |
| Permintaan `wa-sqlite.wasm` di kabel | sebelum paint | **+3,5 s setelah dokumen** (Fast 4G), **+13,0 s** (Slow 4G) |
| Placeholder terlihat | — | **ya, di semua run** |
| Angka `0` palsu saat loading | — | **tidak ada, di semua run** |

Bundle gzip tidak berubah sama sekali — ini murni urutan, bukan pemotongan byte.

### Risiko yang nyata

- **Angka progres melonjak 2–3 detik setelah Home tampil.** Itu konsekuensi yang
  sengaja diterima, bukan bug: lebih baik satu lompatan yang terlihat jelas
  daripada Home yang tidak pernah tampil di link lambat.
- **Di link lambat, CTA aktif ~10,5 s.** User mungkin menekan CTA sebelum DB siap
  (tombol disabled, jadi tidak bisa), tapi harus menunggu storage selesai.
- Placeholder yang salah forgets = lompatan layout. Karena itu ukuran placeholder
  dikunci lewat test snapshot-ish di Home/Profil.

## Yang ditolak

- **Prerender/static render Home.** Menghapus splash sepenuhnya, tapi bertabrakan
  dengan offline-first ADR-004 dan menambah shell web; di luar v1.
- **Ganti SQLite dengan IndexedDB di web.** Menghapus 0,29 MB wasm tanpa mengubah
  urutan, tapi menulis ulang lapisan persistensi yang sudah punya test. Terpisah
  dari keputusan ini.
- **Tampil dengan `0` lalu diberi label "belum dimuat".** Murah, tapi `0` +
  "belum dimuat" = dua klaim yang bertentangan di layar yang sama.
- **Tunggu DB dengan timeout pendek lalu lanjut.** Sama dengan reject but worse:
  flash terjadi pada sebagian device, dan paling sulit direproduksi.

## Verifikasi otomatis

Janji "tidak ada flash" diuji **setiap run** `perf:budget`, bukan hanya diklaim:
baris **"Placeholder tampil selama tunggu storage (ADR-009)"**. Definisi flash di
harness adalah **urutan yang salah** — angka nyata muncul lebih dulu lalu
placeholder menyusul, atau keduanya hidup bersamaan — bukan sekadar "angka 0
terlihat" (pada profil baru `Level 0` itu fakta yang benar).

Dua koreksi alat ukur yang lahir dari ADR ini, keduanya tanpa ini klaimnya
tidak bisa dibuktikan:

   permintaannya. Bukti "wasm keluar dari jalur paint" diambil dari
   permintaannya, halaman maupun worker. Bukti "wasm keluar dari jalur paint"
   diambil dari **log arrival sisi server** (`state.arrivals`), satu-satunya tempat
   yang melihat semua permintaan, dari halaman maupun worker.
2. **Angka `0/1` milik quest ikut tersangkut** kalau placeholder check memakai
   pencocokan longgar; itu false positive yang membuat harness melaporkan
   pelanggaran yang tidak ada.

## Kapan keputusan ini dibuka kembali

- Sumber kebenaran progres pindah dari SQLite ke storage lain (IndexedDB/pintu
  penuh ADR-004) — kalau tidak ada unduhan saat startup, milestone ini selesai.
- Web masuk static rendering / app shell — splash hilang sebagai konsep.
- `__common` 0,29 MB keluar dari jalur paint: lekuk lever yang sama jadi terlalu
  mahal untuk satu keputusan arsitektur.