# PRD — Meowalaf

> **Status**: Draft v1.1 · **Tanggal**: 2026-10-04 · **Pemilik**: Product/Eng
>
> **Meowalaf** (dulu "Ayatin", working title) adalah aplikasi gamifikasi belajar Al-Quran ala Duolingo untuk Gen Z Muslim Indonesia — dengan premis *mualaf*: pengguna baru boleh mulai dari nol. Maskotnya **Abu**, kucing British Shorthair abu-abu ([BRAND.md](BRAND.md)). Satu codebase, tiga platform: Web, Android, iOS. MVP tanpa login — progres tersimpan lokal di perangkat.

---

## 1. Latar Belakang & Problem

Aplikasi Al-Quran yang ada hari ini (Quran Kemenag, Al-Quran Indonesia, dll.) dirancang sebagai *mushaf digital* — lengkap dan kaya fitur, tapi didesain untuk orang yang **sudah punya habit membaca**. Tidak ada produk yang membentuk habit-nya itu sendiri.

Duolingo membuktikan bahwa habit belajar harian bisa dibentuk lewat: sesi pendek (5 menit), progress yang terasa (XP, level), konsekuensi ringan (streak), dan feedback loop yang menyenangkan. Format ini belum diterapkan serius pada belajar Al-Quran untuk audiens Indonesia — negara Muslim terbesar dunia.

**Masalah inti**: Anak muda Muslim Indonesia (16–28) ingin dekat dengan Al-Quran, tapi:
1. Tidak punya waktu/ritme — belajar Quran terasa seperti "kegiatan besar", bukan kebiasaan kecil harian.
2. Aplikasi eksisting terasa "serius dan berat" — visual & bahasanya tidak bicara bahasa mereka.
3. Progres tidak terasa — membaca 1 halaman tidak memberi rasa pencapaian.
4. Terdistraksi & lupa — tidak ada mekanisme yang menarik mereka kembali besok.

## 2. Visi

> "5 menit sehari, Quran jadi kebiasaan."

Jadi aplikasi belajar Al-Quran yang *sekasar Duolingo* dan *semudah scroll TikTok* — tanpa mengorbankan kesopanan terhadap kitabnya (lihat aturan adab di [RULES.md](RULES.md) § 7).

## 3. Target Pengguna & Personas

**Segmen utama**: Muslim Gen Z Indonesia, 16–28 tahun, sudah bisa membaca huruf Arab (bukan target Iqra'), punya smartphone, akses internet tidak stabil di beberapa wilayah.

### Persona 1 — Rani (20, mahasiswi, "mau mulai lagi")
- Dulu hafalan semalam di rumah, sekarang tidak pernah pegang Quran kecuali Ramadan.
- Motivasi: rasa bersalah rendah, ingin mulai "tanpa drama".
- Kebutuhan: onboarding tanpa rasa berdosa, target harian kecil, streak ringan.
- Pain point eksisting: app Quran bikin dia merasa "kurang religius".

### Persona 2 — Bagas (24, fresh graduate, "sibuk tapi pengen konsisten")
- Waktu cuma ada pagi sebelum kerja atau malam sebelum tidur.
- Motivasi: kompetisi ringan (level, XP), target yang menyesuaikan hari sibuk.
- Kebutuhan: sesi ≤ 5 menit, data di device, jalan offline saat commute.
- Pain point: app lain butuh login, lambat buka, butuh internet penuh.

### Persona 3 — Aisyah (17, pelajar, "sudah bisa baca, mau lancar")
- Sudah lancar baca, tapi tidak paham arti; menganggap "ngaji" = sekadar melafalkan.
- Motivasi: konten visual, mini-game, streak bareng teman (nanti, bukan v1).
- Kebutuhan: quiz interaktif, feedback cepat, konfeti dan sound-less reward.
- Pain point: belajar arti ayat terasa seperti hafalan di sekolah.

## 4. Prinsip Produk

1. **Zero friction** — buka app → langsung main. Tanpa login, tanpa form panjang.
2. **Kecil tapi tiap hari** — default target harian 5 menit / 1 lesson; lebih baik konsisten kecil daripada besar lalu putus.
3. **Progres terasa** — setiap ayat yang selesai menghasilkan XP; setiap hari menghasilkan quest.
4. **Sopan pada kitab, santai pada user** — gamifikasi & bahasa Gen Z untuk UI, formal & hormat untuk konten ayat (aturan lengkap di [RULES.md](RULES.md) § 7 dan copy di [DESIGN.md](DESIGN.md) § 5).
5. **Offline-first** — teks & progres 100% di device; hanya audio yang butuh internet.

## 5. Scope MVP (v1)

### 5.1 Onboarding (first-launch, ≤ 30 detik)
1. Splash + value proposition (3 layar swipe, bisa di-skip).
2. Pilih target harian: `Santai (1 lesson)` · `Semangat (2)` · `Ngebut (3)` — default Santai.
3. Pilih surat awal: default Al-Fatihah, atau "mulai dari Juz 30" (daftar surat pendek).
4. (Mobile) Minta izin notifikasi REMINDER setelah lesson pertama selesai — bukan di cold start.

**Acceptance criteria**
- [ ] First-time user mencapai Home tanpa membuat akun.
- [ ] Pilihan target & surat awal tersimpan dan mengubah isi Home + lesson.
- [ ] Skip onboarding dimungkinkan dan menghasilkan default yang masuk akal (Santai, Al-Fatihah).
- [ ] Di run kedua, onboarding tidak muncul lagi.

### 5.2 Home (beranda bento-grid)
Isi: streak hari ini + api streak, progress ring target harian (lesson ke-x dari target), daily quest (3 quest kecil, misal "selesaikan 1 lesson", "tebak 5 arti kata"), tombol besar "Lanjut Ngaji" (melanjutkan lesson/surat aktif), kartu "Terakhir dibaca" (lanjut ke ayat terakhir), badge ringkas (level + XP ke level berikutnya).

**Acceptance criteria**
- [ ] Semua elemen Home ter-render dari state lokal tanpa network call.
- [ ] Streak bertambah saat lesson pertama hari itu selesai; tidak bertambah lagi di lesson kedua.
- [ ] Progress ring penuh → Home menampilkan state "target tercapai" (bukan kosong).
- [ ] Kartu "Terakhir dibaca" membuka mushaf tepat di ayat terakhir yang dibaca.
- [ ] Quest yang sudah tercapai berubah visual sebelum tengah malam (WIB).

### 5.3 Mushaf (baca Al-Quran)
- Daftar 114 surat (nama Arab + latin + arti + jumlah ayat + tempat turun), searchable & sortable.
- Detail surat: bismillah header, ayat Arab (Uthmani) + terjemahan Indonesia, nomor ayat.
- Audio per ayat: tombol play di ayat, auto-lanjut ke ayat berikutnya (mode terus), pilihan 3+ qari.
- Bookmark otomatis "terakhir dibaca" per surat yang dibuka.
- Pengaturan ukuran teks Arab (S/M/L) tersimpan lokal.

**Acceptance criteria**
- [ ] 114 surat ter-list dengan metadata benar (jumlah ayat cocok dengan standar).
- [ ] Teks Arab & terjemahan tampil offline (airplane mode) tanpa placeholder kosong.
- [ ] Play audio di ayat ke-5 surat mana pun memutar audio ayat yang benar.
- [ ] Auto-advance berhenti di akhir surat, tidak error dan tidak loncat ke surat lain tanpa konfirmasi.
- [ ] Ganti qari di tengah memutar audio tetap berfungsi (stop yang lama, mulai yang baru).
- [ ] Ukuran teks Arab berubah live dan tersimpan setelah app ditutup.

### 5.4 Lesson Engine (inti Duolingo)
Satu **lesson** = satu unit kecil di dalam sebuah surat (3–7 ayat, tergantung panjang ayat), dengan struktur:
1. **Materi** (± 30 detik): ayat ditampilkan + terjemahan + audio (wajib diperdengarkan minimal sekali).
2. **Latihan** (4–6 soal) dari 4 tipe:
   - **T1 Pilih Arti**: tampilkan ayat Arab → pilih terjemahan yang benar dari 3 opsi.
   - **T2 Susun Ayat**: tampilkan terjemahan → susun potongan kata Arab dalam urutan benar (tap-to-place).
   - **T3 Lanjutan Ayat**: tampilkan awal ayat N → pilih lanjutan yang benar (opsi: awal ayat N±1 dsb.).
   - **T4 Dengar & Pilih**: putar audio ayat → pilih terjemahan / ayat Arab yang cocok.3. **Hasil**: XP dihitung, akurasi, konfeti, satu layar "resum" lalu balik ke Home.



Mekanika: salah → feedback inline + penjelasan (terjemahan benar ditampilkan), soal salah masuk antrean ulang di akhir sesi (maksimal 1 pengulangan), tidak ada "game over" — lesson selalu selesai.

**Acceptance criteria**
- [ ] Lesson Al-Fatihah dapat diselesaikan end-to-end di semua platform tanpa error.
- [ ] Soal yang dijawab salah muncul kembali di akhir sesi (maks 1×) dan benar → dianggap selesai.
- [ ] XP sesuai aturan di § 5.5 (verify: lesson 5 soal, semua benar tanpa hint = 15 XP jawaban + 5 bonus perfect + 2 bonus selesai = 22 XP).
- [ ] Keluar di tengah lesson (tombol back / app kill) → lesson dianggap belum selesai; progres dalam sesi tidak disimpan.
- [ ] Tipe soal T4 tidak tampil di web saat audio gagal dimuat (fallback ke T1) — degradasi elegan.
- [ ] Materi tidak bisa di-skip sebelum audio diputar minimal sekali (tombol "Lanjut" terkunci, dengan opsi "putar ulang").

### 5.5 Gamifikasi
- **XP**: jawaban benar +3, benar dengan bantuan/hint −1 (min +1), bonus streak sesi (semua benar) +5, lesson selesai +2.
- **Level**: kurva `XP_level(n) = 50 × n × (n + 1) / 2` (level 1 di 50 XP, level 2 di 150, dst.) — progres bar di Home & hasil lesson.
- **Streak**: bertambah 1 ketika target harian pertama kali tercapai (bukan per lesson); hari bolong → streak reset ke 0, dengan **Streak Freeze** gratis 1×/bulan yang otomatis dipakai (bisa dimatikan di settings).
- **Daily quest**: 3 quest/hari, generator deterministic dari tanggal + userId lokal (misal: "1 lesson", "12 jawaban benar", "1 surat baru dibuka") — hadiah XP kecil (+5). *(Quest "tebak arti kata" DITUNDA — glos per kata Indonesia belum ada sumbernya; lihat [ADR-005](adr/ADR-005-quranhub-mcp-enrichment.md) Langkah 3)*
- **Achievement** (v1 minimal 6): "First Step" (lesson pertama), "Starter Streak" (3 hari), "Week Warrior" (7 hari), "Juz 30 Explorer" (buka 5 surat berbeda), "Sharp Ear" (10 soal T4 benar), "Perfect" (lesson tanpa salah).

**Acceptance criteria**
- [ ] Level & progres XP terhitung tepat dari log XP (unit test engine).
- [ ] Streak freeze otomatis terpakai tepat 1× saat bolong, lalu streak lanjut; kedua kalinya reset.
- [ ] Quest 3 item sama untuk user & tanggal yang sama, dan berganti setelah tengah malam WIB.
- [ ] Achievement unlock sekali saja dan muncul sebagai toast + masuk daftar profil.
- [ ] Semua penghitungan bekerja dengan perubahan zona waktu (uji: ubah timezone device, streak tidak dobel).

### 5.6 Reminder harian (mobile only)
- Satu notifikasi lokal per hari, jam yang dipilih user (default 17:00 WIB), hanya berjalan di Android/iOS; di web sembunyikan pengaturan ini.
- Copy reminder beragam & santai (contoh di [DESIGN.md](DESIGN.md) § 5).

**Acceptance criteria**
- [ ] Izin notifikasi diminta hanya setelah lesson pertama selesai (bukan cold start).
- [ ] Notifikasi muncul di jam terpilih di Android & iOS (Emulator/Device).
- [ ] Mengubah jam reminder membatalkan jadwal lama & menjadwalkan ulang.
- [ ] Web tidak menampilkan fitur & tidak crash karena `expo-notifications`.

### 5.7 Profil & Settings
Profil: nama panggilan (default "Sahabat"), avatar emoji pilihan, level + XP, daftar achievement, statistik (total XP, lesson selesai, hari aktif).
Settings: target harian, qari, ukuran teks Arab, jam reminder (mobile), on/off streak freeze, hapus semua data (konfirmasi 2 langkah).

**Acceptance criteria**
- [ ] Ganti nama & avatar langsung terlihat di Home.
- [ ] "Hapus semua data" mengembalikan app ke kondisi onboarding (state lokal bersih).
- [ ] Statistik konsisten dengan log XP (jumlah lesson selesai = jumlah lesson yang benar-benar selesai).

## 6. Model Data Konseptual (ringkas)

- `profile` (nama, avatar, target harian, pengaturan)
- `progress_state` (streak, freeze tersedia, XP total, level cache)
- `lesson_log` (lesson selesai: surat, unit, tanggal, XP, akurasi)
- `answer_log` (per soal: tipe, benar/salah, dipakai untuk quest & statistik)
- `reading_state` (terakhir dibaca, bookmark, surat yang pernah dibuka)
- `srs_item` (v2 — item hafalan; tabel disiapkan, tidak dipakai v1)

Detail teknis: [ARCHITECTURE.md](ARCHITECTURE.md) § 5.

## 7. Non-Goals (v1)

- Login, sinkronisasi cloud, backup akun — v2.
- Leaderboard & liga mingguan — v2 (butuh backend).
- Tafsir lengkap per ayat, asbabun nuzul — v2.
- Mode hafalan penuh dengan SRS — v2 (tabel disiapkan).
- Monetisasi (IAP, iklan, langganan) — tidak di v1.
- Fitur AI (Tanya Ustaz, generator materi) — tidak di v1.
- Bahasa selain Indonesia (UI & terjemahan) — setelah v1 stabil.

## 8. Success Metrics (3 bulan pasca-rilis internal)

| Metrik | Target | Kenapa |
|---|---|---|
| North star: **ayat diselesaikan / user aktif / hari** | ≥ 5 | Mengukur nilai inti, bukan vanity |
| D1 retention | ≥ 35% | Onboarding tanpa friksi |
| D7 retention | ≥ 15% | Loop lesson + streak bekerja |
| % user dengan streak ≥ 3 hari | ≥ 20% | Habit terbentuk |
| Crash-free session | ≥ 99.5% | Kualitas dasar |
| Lesson completion rate | ≥ 70% | Lesson tidak terlalu panjang/sulit |

Catatan: v1 tanpa tracking pihak ketiga & tanpa analytics cloud (privasi, [RULES.md](RULES.md) § 8) → metrik di atas diukur via review manual + feedback qualitative internal hingga analytics first-party ada di v2.

## 9. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| **Akurasi konten Quran** (salah ketik ayat/terjemahan = fatal) | Kredibilitas hancur | Pipeline otomatis + checksum, sumber resmi, sampling review manual sebelum rilis; teks tidak pernah diedit manual di repo ([RULES.md](RULES.md) § 7) |
| Rendering teks Arab rusak di platform tertentu | Tidak layak pakai | Uji awal di 3 platform, pilih font + komponen khusus, teks tak pernah dipecah per kata untuk styling ([DESIGN.md](DESIGN.md) § 8) |
| Lisensi konten terjemahan | Legal | Pakai terjemahan dengan lisensi terbuka (Kemenag open data / sumber open-license terverifikasi lain — keputusan terbuka #2), atribusi di layar About ([ARCHITECTURE.md](ARCHITECTURE.md) § 6) |
| Audio streaming lambat di jaringan buruk | Frustrasi | Audio remote + prefetch ayat berikutnya; UI tetap responsif, tombol play dengan state loading |
| Scope creep fitur sosial | Rilis telat | Non-goals tegas (§ 7); ide baru masuk backlog v2 |
| Streak bug (dobel/reset salah) | Hilang kepercayaan | Streak engine pure + unit test zona waktu ([ARCHITECTURE.md](ARCHITECTURE.md) § 4) |

## 10. Keputusan Terbuka (untuk diputuskan belakangan)

| # | Keputusan | Options | Deadline |
|---|---|---|---|
| 1 | Nama final app | **Diputuskan 2026-10-04: Meowalaf** (Meow + Mualaf) — lihat [BRAND.md](BRAND.md) § 1–4 | Selesai (mencadang: nama boleh berubah lagi sebelum rilis publik, tapi kode & aset sudah memakai nama ini) |
| 2 | Sumber terjemahan final (Kemenag vs lain) | Cek lisensi & kualitas | Saat Phase 1 |
| 3 | Kurva level (50n(n+1)/2 vs 100n²) | Tuning pasca-beta | Phase 3 |
| 4 | Library audio player mobile (expo-av vs expo-audio) | Ikuti versi Expo SDK | Phase 1 spike |
