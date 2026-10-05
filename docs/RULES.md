# Rules — Meowalaf

> **Status**: v1.1 · **Tanggal**: 2026-10-04 · Companion: [PRD.md](PRD.md), [ARCHITECTURE.md](ARCHITECTURE.md), [DESIGN.md](DESIGN.md), [BRAND.md](BRAND.md), [ROADMAP.md](ROADMAP.md)
>
> Aturan ini binding. Pelanggaran aturan § 7 (adab & konten) adalah *release blocker*, bukan catatan review.

## 1. Prinsip Umum

1. **Kesederhanaan menang.** Tidak buat abstraksi sebelum ada ≥ 2 pemakai nyata. Boundary adalah untuk kejelasan, bukan seremoni.
2. **Engine sebelum UI.** Fitur dimulai dari types + pure functions + test, baru layar.
3. **Perilaku dulu, rapi kemudian, dipoles terakhir.** Jangan optimasi sebelum diukur.
4. **Satu perubahan, satu tujuan.** Commit/PR tidak mencampur refactor dengan fitur.

## 2. Struktur & Dependensi

- Struktur folder mengikuti [ARCHITECTURE.md](ARCHITECTURE.md) § 3 — itu sumber kebenaran; folder baru butuh alasan di PR.
- Arah import: `app/ → features → core → data`; `ui/` dipakai semua tapi tidak meng-import features/core. Dilakukan pemeriksaan otomatis (lint `import/no-restricted-paths`) saat lint terpasang di Phase 1.
- Tidak ada *circular import* antar modul apa pun.
- File > 300 baris → dipertanyakan untuk dipecah; komponen > 150 baris → cek apakah ada sub-komponen.

## 3. Kode (TypeScript)

- **Strict mode penuh**, termasuk `noUncheckedIndexedAccess`. **`any` dilarang** (incl. implisit); pakai `unknown` + narrowing.
- Ekspor fungsi/objek, hindari class (kecuali AudioController yang memang stateful singleton).
- Nama: `camelCase` fungsi/variabel, `PascalCase` tipe/komponen, `SCREAMING_SNAKE` konstanta, file `kebab-case` (komponen `PascalCase.tsx`).
- Komponen tidak boleh: memanggil SQLite langsung, fetch jaringan, menghitung XP/streak, atau mem-parsing tanggal sendiri — semua lewat hooks/engine.
- Tanggal: SELALU lewat helper `toWibDate()` (WIB = zona waktu produk). Dilarang `new Date()` tanpa sadar zona untuk logika streak/quest.
- Magic number dilarang: XP, target, durasi → konstanta bernama di modul masing-masing.
- Error handling: jangan `catch` lalu diam; minimal log terstruktur + state error yang terlihat user (copy di [DESIGN.md](DESIGN.md) § 5).

## 4. State & Data Flow

- Satu owner per state ([ARCHITECTURE.md](ARCHITECTURE.md) § 1.3). Tidak ada duplikasi sumber kebenaran; turunan dihitung (selector), bukan disimpan dua kali.
- Progres user HANYA berubah lewat actions `core/progress` store. Komponen subscribe, tidak mutasi.
- Log (`lesson_log`, `answer_log`) bersifat append-only; tidak ada UPDATE/DELETE pada log (kecuali "hapus semua data").
- `progress_state` harus bisa direkonstruksi dari log — kalau tidak bisa, skema salah.

## 5. Git & Kolaborasi

- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:` (contoh: `feat(lesson): quiz tipe susun-ayat`).
- Trunk-based: branch pendek umur < 2 hari dari `main`, merge squashed, tidak ada long-lived branch.
- PR kecil (< ~400 baris diff), deskripsi menyebut user story / acceptance criteria yang dicover.
- Commit TIDAK PERNAH berisi `src/data/content/*.json` hasil generate manual — hanya lewat pipeline (§ 7.2).

## 6. Definition of Done (per fitur/PR)

- [ ] `tsc --noEmit` lolos tanpa error.
- [ ] ESLint lolos (aturan aktif sejak Phase 1; sebelum lint terpasang, review manual menggantikan).
- [ ] Unit test engine lulus; fitur engine baru wajib datang dengan test.
- [ ] Manual check di **web + Expo Go (Android atau iOS)**: tidak ada error/warning baru di console.
- [ ] Acceptance criteria user story di [PRD.md](PRD.md) § 5 tercentang atau issue dibuat untuk gap-nya.
- [ ] Tidak ada dead code, komentar bekas debug, atau `console.log` liar.
- [ ] Copy UI baru mengikuti [DESIGN.md](DESIGN.md) § 5 (termasuk garis merah).

## 7. Adab & Akurasi Konten Quran ⚠️ (release blocker)

1. **Teks Arab tidak pernah diedit manual.** Perubahan hanya lewat pipeline `scripts/build-content` + checksum ([ARCHITECTURE.md](ARCHITECTURE.md) § 6). Diff teks Arab di review wajib ditolak kecuali berasal dari emit pipeline.
2. **Validasi otomatis**: jumlah ayat per surah == standar; checksum bundle tercatat di `manifest.json`; pipeline mencetak diff untuk sampling review manusia sebelum bundle di-commit.
3. **Tidak menampilkan ayat tanpa konteks yang benar**: ayat selalu dengan nomor surah:ayat; terjemahan tidak pernah digabung/memotong ayat; ayat tidak dipakai sebagai dekorasi UI.
4. **Teks ayat tidak dimodifikasi secara visual** yang merusak bacaan: tidak dipecah per kata untuk animasi, tidak diberi letter-spacing, tidak diberi emoji/annotation di dalam blok ayat ([DESIGN.md](DESIGN.md) § 8).
5. **Copy sopan di sekitar konten suci**: emoji/slang tidak pernah bersebelahan langsung dengan teks ayat atau nama surah ([DESIGN.md](DESIGN.md) § 5).
6. **Atribusi**: semua sumber (teks, terjemahan, audio, murottal, dan hadis beserta rawi + nomornya) dicantumkan di layar "Tentang & Sumber Konten" (`app/about.tsx`, dibuka dari Profil) — wajib ada sebelum rilis publik apa pun. Layar ini menampilkan **seluruh** entri hadis, bukan hanya hadis yang sedang tampil di Home: atribusi yang ikut rotasi harian bukan atribusi, karena sebagian besar sumber tidak akan pernah terlihat user.
7. **Review manusia**: sebelum rilis internal ke orang luar tim, sampling review (min. 5 surat acak penuh) oleh pemeriksa yang teliti terhadap teks & terjemahan. Temuan = kembali ke pipeline, bukan quick-fix di JSON.
8. **Lisensi**: hanya konten dengan lisensi terbuka/jelas yang masuk bundle; lisensi tercatat di manifest. Sumber tanpa izin redistribusi → tidak dipakai.
9. **Maskot & ornamen brand** ([BRAND.md](BRAND.md) § 6): kucing Abu hanya muncul di meta-experience (onboarding, kartu sapaan, empty state, badge streak, hasil lesson) — **tidak pernah** di dalam/di samping blok ayat, nama surah, atau metadata mushaf. Peci **boleh** (pakaian sehari-hari, keputusan produk 4 Okt 2026), tapi maskot **tidak pernah meniru gerakan ibadah** (sujud/salat), tidak memakai sajadah atau mihrab sebagai properti komponen, dan **tidak ada teks Arab/Ayat yang digambar palsu** di ornamen, kitab maskot, atau ikon. Ornamen islami dibatasi pada bulan sabit/bintang emas + peci. Aset brand WAJIB digambar di repo ini: ilustrasi acuan berwatermark hanya boleh menentukan gaya, tidak pernah disalin atau diunduh ke repo.

10. **Hadis**: hanya hadis **shahih** dari Bukhari/Muslim, dan kutipan **tidak pernah
    tanpa atribusi** — rawi + collection + nomor hadis, menempel pada teks. Matn tidak
    pernah diedit, dipotong, atau diringkas demi enak tampil (pola yang sama dengan ayat,
    § 7.1). Yang bisa dijaga otomatis hanya **kelengkapan bentuk** (test gagal kalau
    entri kehilangan nomor / menyebut sumber lain / matn-nya terpotong / ada huruf
    Latin di dalam matn). **Kebenaran nomor hadis dan ketepatan teks Arab tidak bisa
    dicek test mana pun**, jadi § 7.7 (review manusia) adalah satu-satunya penjaga di
    sini — sebelum rilis publik, setiap entri di `src/features/home/hadith.ts` wajib
    dicocokkan ulang dengan sumber tertulis. Nomor yang keliru adalah kesalahan
    religi yang lebih serius daripada bug UI, dan tidak akan muncul di QA visual.
    Terjemahannya juga **diawali huruf besar** di semua locale — terjemahan hadis pernah
    ikut memakai gaya huruf kecil milik copy meta-experience, dan itu langsung merusak
    kesan formal yang justru melanggar aturan yang sedang dibela di paragraf ini.

## 8. Privasi & Data

- v1: **tanpa analytics pihak ketiga, tanpa tracking, tanpa akun** — semua data hanya di device user ([PRD.md](PRD.md) § 8).
- Tidak ada SDK iklan. Tidak ada request izin di luar notifikasi (mobile).
- "Hapus semua data" benar-benar menghapus (DB + storage), tanpa salinan tersembunyi.
- Bila nanti analytics first-party ditambahkan (v2): opt-in, transparan, tanpa konten aktivitas mengaji sebagai data perilaku — hanya metrik agregat fitur.

## 9. Performance Budget (dicek di Phase 3, dijaga sejak Phase 1)

> Budget ini hasil keputusan **[ADR-008](adr/ADR-008-budget-startup-fast-4g-bukan-slow-4g.md)**
> (3 Okt 2026). Semuanya diukur, bukan dikira: `npm run perf:budget` membuat link
> throttled sungguhan; angka lengkap dan cara repeat di [PERF.md](PERF.md).

| Metrik | Profil link | Budget | Terukur (4 Okt 2026) |
|---|---|---|---|
| First contentful paint (tampilan pertama) | Slow 4G | < 10.0s | 7,5-8,2 s |
| Startup app -> Home interaktif (web, cache kosong) | Fast 4G | < 5.0s | 2,05-3,62 s |
| Placeholder tampil tanpa angka 0 saat storage belum siap | semua | ya, tanpa angka 0 | ya, di semua run |
| Buka layar lesson -> interaktif | Fast 4G | < 2.0s | 0,50-0,58 s |
| Play audio ayat -> byte pertama (cached metadata) | tanpa throttle | < 500ms | 4-10 ms |
| Ukuran bundle web (gzip, tanpa audio) | - | < 3 MB | 1,98 MB |
| Drop frame saat animasi standar | device kelas bawah | < 5% | belum terbukti di device |

Cara membaca tabel ini:

- **Satu metrik, satu profil link.** Angka di profil lain tetap dihitung dan
  ditampilkan, tapi tidak diberi verdict LULUS/GAGAL, supaya terlihat tanpa dipakai
  sebagai alasan "lolos". `scripts/perf-budget.mjs` menerapkan aturan ini.
- **Budget bundle 8 MB -> 3 MB.** Angka 8 MB tidak pernah menangkap apa pun
  (terukur 1,98 MB). Karena tidak ada lagi budget waktu di link lambat, **budget
  byte yang sekarang jadi penjaga utama**: byte naik berarti waktu naik.
- **Drop frame masih belum terbukti.** 0,00 % terukur di laptop headless tanpa GPU;
  itu belum jawaban untuk device kelas bawah, jadi metrik ini tetap menunggu device.
- **Angka progres tidak boleh tampil sebagai `0` sebelum storage siap.** Di web
  splash tidak lagi menunggu SQLite (ADR-009) — unduhan wasm-nya justru dimulai
  setelah Home tampil, supaya tidak berebut pipa dengan entry dan font. Karena itu
  angka yang belum termuat **WAJIB** ditampilkan sebagai placeholder dengan slot
  berukuran sama (supaya angka aslinya masuk tanpa lompatan layout), `0` tidak boleh
  tampil seolah-olah itu fakta, dan "Lanjut Ngaji" **disabled** sampai repo siap.
  Angka quest **tidak** ikut di-skeleton karena bersumber AsyncStorage (nilainya benar
  sejak awal). Harness menegakkan aturan ini tiap run lewat baris "Placeholder tampil
  selama tunggu storage".

### Kenapa tidak ada lagi "startup < 2,0 s di 4G throttled"

Target lama itu tidak gagal karena app lambat, tapi karena **tidak mungkin secara
fisis** untuk stack web sekarang. Hitungannya (semua angka terukur, [PERF.md](PERF.md)):

1. **Transfer saja sudah melewati target.** Slow 4G = 1,6 Mbps = 200 KB/s dengan
   RTT 150 ms. Byte yang benar-benar turun sebelum Home tampil = **0,92 MB** ->
   **4,6 detik** hanya untuk mengirim, dengan nol parse dan nol render. Target 2,0 s
   menuntut total **<= 400 KB** sebelum Home.
2. **First paint tidak menyelamatkan.** Memindahkan target ke "tampilan pertama"
   kedengarannya murah, tapi FCP di Slow 4G terukur **8,6 s**: layar splash memang
   kosong sampai font dan SQLite siap, jadi tidak ada yang bisa dicatat lebih awal.
   Di Fast 4G FCP 2,5 s vs Home 4,1 s — selisihnya cuma ~1,6 s. First paint karena itu
   tetap dipasang di link lambat, bukan di link cepat.
3. **Sisanya bukan bytecode sembarangan.** 0,92 MB itu `__common` 0,29 MB (zod +
   UI bersama), wasm SQLite, font subset 0,14 MB, dan entry. Yang termurah dipangkas
   adalah `__common` dan `Ionicons.ttf`; SQLite tidak bisa keluar dari jalur splash
   tanpa keputusan produk (keputusan itu sudah diambil di [ADR-009](adr/ADR-009-home-tampil-sebelum-sqlite-selesai.md):
   splash tidak lagi menunggu DB, dan batasan "angka tidak boleh melompat"
   dipindah dari splash ke placeholder di layar).
4. **Jadi ini keputusan arsitektur, bukan optimasi.** 2,0 s di Slow 4G butuh shell web
   lain: static rendering (prerender HTML Home) atau app shell tanpa SQLite di web.
   Keduanya biaya produk nyata (offline-first ADR-004, SEO, kompleksitas), keduanya di
   luar v1.

Konsekuensi yang diterima: startup di Fast 4G (target utama, < 5,0 s) dan first paint
di Slow 4G (jaring pengaman, < 10,0 s) menjadi penjaga; sementara Slow 4G **tetap
diukur dan ditampilkan** setiap run, hanya tidak lagi diberi verdict. Kalau nanti shell
web berubah (static rendering / IndexedDB), budget ini harus dihitung ulang dari
pengukuran baru — bukan diwarisi.

## 10. Keamanan (walau v1 tanpa backend)

- Tidak ada secret di repo; `.env` di-gitignore; contoh di `.env.example`.
- Dependency baru harus dipertimbangkan ukurannya (bundle budget § 9) dan lisensinya.
- `npm audit` / `expo install:check` rutin; CI gagal pada vulnerability critical.

## 11. Testing Rules

- Engine baru tanpa test = PR tidak merge (aturan aktif sejak Phase 1).
- Test streak wajib mencakup: hari sama, lintas midnight WIB, lintas timezone device, freeze terpakai, freeze habis.
- Test lesson grading wajib mencakup: 4 tipe soal, retry queue, hint, lesson selesai/salah semua.
- Snapshot test hanya untuk output kecil & stabil (manifest, konten sample), tidak untuk UI penuh.

## 12. Dokumentasi

- Dokumen di `docs/` adalah sumber kebenaran produk; perubahan keputusan → update dokumen di PR yang sama dengan kodenya.
- Setiap modul baru di `src/` wajib punya header komentar 3–6 baris: apa, siapa ownernya, siapa yang boleh meng-import.
- ADR (Architecture Decision Record) ringkas dibuat untuk keputusan besar (pilihan audio library, sumber terjemahan) — format bebas, satu file di `docs/adr/`.
