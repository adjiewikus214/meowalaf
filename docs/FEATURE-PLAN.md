# Feature Plan — 8 area fitur (4 Okt 2026)

Rencana untuk 8 area fitur yang diambil dari feature list **Meowslim** (pembanding
terdekat, [BRAND.md](BRAND.md) § 1). Dokumen ini menjawab: mana yang **sudah ada**,
mana yang murah, mana yang mahal, mana yang **bertabrakan dengan keputusan produk yang
sudah diambil**, dan mana yang **diblokir lisensi**.

> Feature list adalah inventaris kebaruan kompetitor, bukan daftar kebutuhan. Menyalinnya
> mentah-mentah akan menghapus pembedaan yang justru jadi alasan app ini ada.

---

## 0. TL;DR

| # | Area | Sekarang | Biaya | Risiko | Saran |
|---|---|---|---|---|---|
| 1 | Quran 30 juz, bookmark, Yasin | 70% ada | **S** | rendah | **Ambil** |
| 2 | Murottal & tafsir | 50% ada, tanpa tafsir | M | **lisensi tinggi** | **Ambil** |
| 3 | Doa & Asmaul Husna | 0% | M | **lisensi tinggi** | Asmaul Husna saja |
| 4 | Jadwal salat & adzan | 0% | **XL** | akurasi, izin lokasi | **Jangan** |
| 5 | Kiblat | 0% | L | hardware | **Jangan** |
| 6 | Kalender Hijriah | 0% | M | akurasi, konten sensitif | **Jangan** |
| 7 | Tasbih & dzikir | 0%, tapi mesinnya ada | **S** | rendah | **Ambil** |
| 8 | Worship tracker & catatan | 20% (hadis sudah ada) | S–M | privasi | Ambil sebagian |

Rekomendasi: ambil **1, 2, 7**, plus Asmaul Husna dari 3 dan catatan pribadi dari 8.
Tolak 4, 5, 6 dengan alasan tertulis, bukan sekadar "susah".

---

## 1. Tabrakan posisi produk

[BRAND.md](BRAND.md) § 1 menetapkan posisi Meowalaf:

> **Meowslim** menemani orang yang **sudah** beribadah; **Meowalaf** menemani orang
> yang **baru mulai** — premisnya di nama: *Meow + Mualaf* = kucing yang baru belajar agama.

Setelah riset, [BRAND.md](BRAND.md) § 1 juga sudah menulis verdict-nya:

> **Apa yang sengaja TIDAK ditiru.** Jadwal salat/adzan/kiblat/kalender Hijriah: itu
> produk lain dengan biaya perawatan besar … Kalau nanti diadopsi, harus jadi ADR sendiri
> dengan sumber data & uji akurasi — bukan tempelan.

Area 4, 5, dan 6 persis tiga yang sudah ditolak itu. Menyalin feature list secara utuh
berarti membalik keputusan produk yang diambil 4 Okt 2026, dan mengubah Meowalaf menjadi
Meowslim dengan nama berbeda.

Area 1–3 dan 7–8 tidak bertabrakan: semuanya soal belajar dan kebiasaan.

---

## 2. Peta per area

### Area 1 — Quran 30 juz, bookmark, Yasin

**Sudah ada**, lebih dari yang biasanya dikira: mushaf 114 surat dengan teks Uthmani,
terjemahan, murottal per ayat dari beberapa reciter, dan posisi baca.

**Yang belum ada:**

| Kebutuhan | Kenapa belum | Ukuran |
|---|---|---|
| **Bookmark favorit** | Yang ada cuma `lastRead` **otomatis** — dibuka sekali lalu ditulis sendiri ([reading.ts](src/core/progress/reading.ts)). Itu bukan favorit yang dipilih user. | **S** |
| **Mode baca berurutan (juz)** | Mushaf sekarang list per surat, tidak ada "baca langsung dari Juz 1". | S |
| **Surah Yasin terpisah** | Cuma shortcut navigasi ke `/surah/36`. Murah. | **S** |

**Aset yang belum dipakai**: `word-data-juz30.json` (135,6 KB) berisi data **per kata**
untuk Juz 30. Itu modal untuk baca per kata dan untuk mode hafalan "tebak lanjutan ayat".

**Verdict: ambil.** Paling murah di seluruh daftar, dan langsung menambah kegunaan.

---

### Area 2 — Murottal & tafsir

**Sudah ada**: murottal per ayat, `audio-reciters.json`, prefetch, `AudioController`
dengan state loading, dan budget TTFB yang sudah terukur.

**Yang belum**: **tafsir**. Ini satu-satunya bagian dari seluruh daftar yang benar-benar
menguatkan posisi "belajar". Pemula yang baca terjemahan belum tentu paham maknanya;
tafsir adalah jawabannya.

**Blokernya bukan teknis, tapi lisensi.**

- Tafsir adalah karya berhak cipta. Yang relatif terbuka: Tafsir Kemenag (open data, perlu
  verifikasi syarat penggunaan), Tafsir Muyassar. Yang **tidak** boleh dipakai: terjemahan
  Ibn Katsir atau Al-Tabari versi translator Indonesia tanpa izin.
- [RULES.md](RULES.md) § 7.8: hanya konten dengan lisensi terbuka yang boleh masuk bundle,
  dan lisensinya tercatat di manifest.

**Verdict: ambil, tapi hanya lewat pipeline `scripts/build-content` yang sudah ada** —
dengan atribusi per ayat, validasi zod seperti terjemahan, dan fail-closed kalau lisensinya
belum diverifikasi. Ini sudah ada di [ROADMAP.md](ROADMAP.md) § 6 backlog item 4; elevating
nya ke janji rilis berarti kontennya harus benar-benar siap, bukan placeholder.

---

### Area 3 — Doa harian & Asmaul Husna

**Asmaul Husna — murah dan beda.**
Isinya nama, arti, dan keutamaan. Tidak ada masalah lisensi selama **arti ditulis sendiri**,
bukan kutipan dari buku. Tetap perlu review bahasa, karena "arti" bisa menyerupai fatwa.
99 entri × 2 locale = 198 string, manageable, dan cocok dengan posisi "belajar".

**Doa harian — hati-hati.**
Ribuat doa harian umumnya berasal dari karya berhak cipta (Kanzul Iman, DzikirCollection,
dan sejenisnya) yang status lisensinya **tidak jelas**. Risiko identik dengan tafsir.

**Verdict: Asmaul Husna ya, doa tertanggu.** Kalau doa tetap mau, harus dengan sumber
terverifikasi — dan itu keputusan lisensi, bukan pekerjaan frontend.

---

### Area 4 — Jadwal salat & adzan — **jangan**

> **Diperbarui 5 Okt 2026**: keputusan ini **dibalik sebagian** oleh
> [ADR-010](adr/ADR-010-jadwal-salat-kiblat-pengingat.md) — jadwal salat kini
> dihitung lokal di device (library `adhan`, metode Kemenag + ihtiyati 2 menit)
> dan lima waktunya jadi notifikasi lokal. **Adzan audio tetap ditolak**: alasan
> nomor 3 di bawah (hak audio, Doze, alarm presisi) tidak berubah karena waktu
> salat bisa dihitung. Alasan di bawah dipertahankan utuh sebagai jejak kenapa
> fitur ini pernah ditolak — dan sebagai daftar hal yang harus dijawab kalau
> adzan audio nanti diminta.

Alasannya teknis dan serius, bukan sekadar mahal:

1. **Butuh lokasi.** `expo-location` belum jadi dependency. Menambahnya berarti izin lokasi,
   yang menyentuh [RULES.md](RULES.md) § 8 (privasi, tanpa izin di luar notifikasi).
   Perlu ADR tersendiri.
2. **Algoritma waktu salat.** Ada metode standar, tapi hasilnya **berbeda antar metode**
   dan bisa berbeda beberapa menit. Setiap perbedaan berarti ada orang yang salatnya
   terlewat. Ini bukan detail kecil.
3. **Adzan.** Butuh hak audio, notifikasi background yang harus lolos Doze di Android,
   dan alarm presisi tinggi yang perilakunya berbeda-beda antar OEM Android — kelas
   masalah yang tidak bisa ditutup oleh perhitungan waktu salat.
4. **Maintenance tahunan.** Parameter dan tabel harus diperbarui tiap tahun, dan kesalahan
   berarti ada user yang kehilangan salat. Ini kewajiban yang bertahan seumur hidup produk.

**Verdict: tolak untuk v2.** Kalau nanti, harus jadi ADR sendiri dengan sumber data, uji
akurasi lintas beberapa kota, dan konsekuensi bila user salah waktu.

**Verdict yang berlaku sekarang (5 Okt 2026):** ADR-010 diterima untuk jadwal salat +
notifikasi waktu salat, **tanpa adzan audio** — syarat "ADR dengan sumber data & uji
akurasi lintas kota" dipenuhi di sana (uji 4 kota x 2 tanggal, toleransi 2 menit).

---

### Area 5 — Kiblat — **Jangan**

> **Diperbarui 5 Okt 2026**: [ADR-010](adr/ADR-010-jadwal-salat-kiblat-pengingat.md)
> merilis **arah kiblat sebagai sudut** (bearing great-circle dari utara sebenarnya,
> dihitung dari koordinat) — **tanpa kompas**. Alasan di bawah tetap berlaku untuk
> kompas: sensornya belum bisa diuji di web/CI, jadi tidak dijanjikan. Panah yang
> berputar menunggu device fisik untuk QA.

1. Butuh **kompas** (sensor magnetometer) plus lokasi. Keduanya belum ada.
2. **Tidak bisa dipertanggungjawabkan di web.** iOS Safari tidak mendukung web API
   orientasi perangkat, jadi fitur ini akan selalu degraded di salah satu dari tiga
   platform.
3. Akurasi pointer di ponsel murah sering meleset beberapa derajat, sedangkan arah kiblat
   tidak bisa "hampir benar".

**Verdict: tolak.** Butuh hardware yang tidak bisa diuji di lingkungan sekarang.

---

### Area 6 — Kalender Hijriah — **jangan**

1. **Konversi Hijriah itu ambigu.** Umm al-Qura, tabel Islami, dan pengamatan hilal bisa
   berbeda **satu sampai dua hari** untuk tanggal yang sama. Tidak ada satu jawaban "benar"
   tanpa menyebut metode yang dipakai.
2. **Perlu pembaruan tahunan.** Tabel Umm al-Qura harus di-update tiap tahun; kalau tidak,
   tanggal Ramadan meleset.
3. **Konten sensitif.** Tanggal besar seperti Idul Fitri atau Arafah, kalau meleset, berarti
   user salah ibadah di hari besar. Ini risiko setara release blocker, walau bukan ayat.
4. [PRD.md](PRD.md) § 7 juga sudah menandainya sebagai non-goals v1.

**Verdict: tolak.** Kalau tetap mau, versi aman hanya menampilkan perkiraan tanggal Hijri
dengan label "perkiraan" yang eksplisit — tapi itu menurunkan nilainya jadi dekorasi.

---

### Area 7 — Tasbih & dzikir — **ambil**

Ini paling cost-effective di daftar: **mesinnya sudah ada**.

- `xp_ledger` (migration v2) sengaja dirancang untuk XP di luar lesson. Baru dipakai untuk
  bonus quest; hadiah tasbih langsung masuk ke sana.
- `progress_state` sudah punya `streak_count` harian; dzikir tinggal menambah event.
- Butuh satu tabel `dhikr_log` append-only per hari, mengikuti pola `lesson_log`.
- UI: layar counter besar, target harian, dan pilihan dzikir.

**Catatan**: tasbih bukan permainan. Kalau ada tombol reset atau penilaian benar-salah,
itu bukan tasbih. Dzikir tidak punya konsep "salah".

**Verdict: ambil, dan jadikan v2 nomor 1.**

> **Status (2026-10-05) — selesai, satu penyimpangan dari rencana di atas yang disengaja**:
tidak ada tabel `dhikr_log`. Hitungan tap tasbih hidup di AsyncStorage (`ayatin-tasbih-v1`,
sama seperti quest) karena tap dzikir bukan peristiwa belajar yang perlu direkonstruksi —
yang perlu append-only cuma **XP-nya**, dan itu sudah masuk `xp_ledger` lewat `addBonusXp`.
Tanpa tabel baru, tidak ada migrasi, dan `reconcileProgressDay` tetap satu-satunya jalur
rekonstruksi XP.
>
> **Streak-nya lewat jalur yang sama, bukan logika kedua**: `core/progress/lesson-store.ts`
dapat aksi generik `reachDailyTarget(day, {freezeEnabled})` yang memakai fungsi PURE
`onDailyTargetReached` yang sudah ada. Ia **tidak** menambah `lessonsToday` (ring Home tetap
hitungan lesson) dan idempoten per hari, jadi tasbih dan lesson tidak mungkin menghitung
streak dua kali: yang pertama mencapai target harian yang menaikkannya.
>
> Aturan hadiah (PURE, `features/tasbih/tasbih.ts`): +5 XP saat satu preset menyelesaikan
> putaran pertamanya hari itu, +10 XP saat total harian mencapai target. Keduanya dibatasi
> **sekali per hari** — tanpa itu, memutar tasbih 33x berulang jadi ladang XP.
>
> **Pelanggaran yang dicegah lewat test**: mengganti target harian tidak boleh menghapus
> dzikir yang sudah dikerjakan (`withTarget`), dan bonus target tidak dibayar saat target
> diturunkan (kalau dibayar, target 1 di detik pertama = XP gratis).
>
> **Lanjutan (5 Okt 2026) — dzikir masuk gamifikasi**: pool quest bertambah kategori
> `dzikir` (33 / 100 dzikir hari ini) dan daftar achievement bertambah dua (Dhikr Starter 33,
> Dhikr Marathon 1000). Tasbih tetap jadi SUMBER: quest memakai `applyDzikir` yang menyimpan
> nilai tertinggi (reset hitungan tidak membatalkan quest), achievement menyimpan total
> lifetime sendiri lewat `onDzikirTap`.
>

---

### Area 8 — Worship tracker & catatan pribadi

- **Kutipan harian** — sudah ada, itu kartu hadis yang baru dibuat.
- **Catatan pribadi** — sedang, tapi [RULES.md](RULES.md) § 8: data lokal saja, tanpa sinkron.
  Kalau nanti ada sinkron (backlog v2 item 1), catatan pribadi jadi data paling sensitif
  dan harus dikeluarkan dari scope backup itu.
- **Tracker ibadah lima waktu** — bergantung pada Area 4. Kalau jadwal salat ditolak,
  tracker-nya tidak punya sumber. Tracker **dzikir** bisa hidup sendiri lewat Area 7.

**Verdict: ambil catatan pribadi dan tracker dzikir; tracker salat menunggu Area 4.**

---

## 3. Urutan pengerjaan

| Fase | Isi | Estimasi | Alasan |
|---|---|---|---|
| **A** | ~~Bookmark favorit + shortcut Yasin~~ **selesai 2026-10-04** · sisa: mode baca juz, tasbih + XP | 2–3 sprint | Semua pakai infra yang sudah ada. Nol dependency baru, nol konten berlisensi |
| **B** | Tafsir (kalau lisensi terverifikasi), Asmaul Husna | 3–5 sprint | Butuh keputusan lisensi lebih dulu. Asmaul Husna bisa jalan sendiri tanpa tafsir |
| **C** | ~~Layar "Tentang & Sumber" ([RULES.md](RULES.md) § 7.6)~~ **selesai 2026-10-04** | — | Wajib sebelum rilis publik |
| **D** | ADR yang menjelaskan kenapa Area 4–6 ditolak | — | Kalau nanti berubah, alasannya sudah tertulis |

**Yang harus didahulukan dari Fase C**: halaman atribusi adalah syarat [RULES § 7.6](RULES.md#L66)
dan tidak bergantung pada fitur mana pun. App sudah menampilkan kutipan hadis sebelum
halaman sumbernya ada — urutan itu salah, dan sekarang sudah diperbaiki: `app/about.tsx`
membaca `HADITHS` (seluruh 6 entri, bukan `hadithForDay`) sehingga rawi + nomor tiap hadis
terlihat sekaligus.

---

## 4. Yang tidak dikerjakan, dan alasannya

| Feature | Alasan penolakan |
|---|---|
| Jadwal salat & adzan | Butuh lokasi, algoritma, notifikasi background, dan maintenance tahunan. Salah = ada user yang kehilangan salat |
| Kiblat | Butuh magnetometer; tidak didukung iOS Safari; tidak bisa diuji sekarang |
| Kalender Hijriah | Konversi ambigu satu-dua hari; perlu update tahunan; tanggal hari besar yang meleset berarti kesalahan ibadah |
| Doa dari sumber tidak terverifikasi | Lisensi tidak jelas = release blocker menurut [RULES § 7.8](RULES.md#L70) |
| Menyalin seluruh feature list | Membalik posisi produk di [BRAND § 1](docs/BRAND.md#L31) dan menghapus pembedaan |

---

## 5. Yang harus diputuskan produk

1. **Lisensi tafsir** — sumber mana yang dipakai? Ini menentukan apakah Fase B jalan.
   Tidak bisa dijawab oleh engineering.
2. **Bookmark** — jadi fitur atau tidak? Kalau ya, perlu tempat baru untuk favorit yang
   dipilih user, karena yang ada sekarang hanya `lastRead`.
3. **Tasbih** — preset dzikir, atau input bebas? Preset lebih sederhana; input bebas lebih
   dekat ke tasbih sungguhan.
4. **Apakah posisi "belajar" masih dijaga** — kalau Area 4–6 tetap ditolak, feature list
   ini jadi 4 dari 8 yang diambil, dan itu pilihan yang konsisten.

---

## 6. Ringkasan

Feature list kompetitor bukan backlog. Yang benar-benar layak:

- **Sudah jadi**: Quran lengkap, murottal, terjemahan, posisi baca, kutipan harian
- **Murah dan bernilai**: bookmark, mode juz, tasbih
- **Bernilai tapi mahal**: tafsir, dan hanya kalau lisensinya beres
- **Harus ditolak**: jadwal salat, adzan, kiblat, kalender Hijriah — sudah diputuskan di
  [BRAND § 1](BRAND.md#L31), dan alasannya masih berlaku

Menambah area yang sudah ditolak bukan menambah nilai. Itu menghapus pembedaan.