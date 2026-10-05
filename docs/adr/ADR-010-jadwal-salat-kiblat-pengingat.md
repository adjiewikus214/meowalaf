# ADR-010 — Jadwal salat & kiblat dihitung di device; pengingat salat dari notifikasi lokal

> **Status**: Diterima · **Tanggal**: 5 Okt 2026 · **Konteks**: Phase 3, fitur
> harian (setelah tasbih & quest dzikir). Membalik sebagian keputusan tertulis di
> [FEATURE-PLAN.md](../FEATURE-PLAN.md) § 1/§ 2 Area 4–5, sesuai syarat di
> [BRAND.md](../BRAND.md) § 1 ("kalau nanti diadopsi, harus jadi ADR sendiri dengan
> sumber data & uji akurasi"). Prasyarat: [ADR-002](ADR-002-sumber-konten-equran-id.md)
> (sumber konten), [ADR-004](ADR-004-bundle-konten-penuh.md) (offline-first).

## Konteks

FEATURE-PLAN menolak Area 4 (jadwal salat + adzan), Area 5 (arah kiblat), dan Area 6
(kalender Hijriah) dengan alasan yang masuk akal saat itu: jadwal salat dianggap butuh
**data per kota dari server** (API atau tabel yang harus dirawat), kiblat butuh
**kompas** (sensor + izin + kalibrasi), dan akurasi yang salah pada ibadah jauh lebih
mahal daripada fitur yang tidak ada. Untuk app tanpa backend, itu berarti fitur ini
"tidak bisa dibuat dengan benar".

Dua hal berubah:

1. **Waktu salat bukan data — ia fungsi matematis** dari koordinat + tanggal (posisi
   matahari). Tidak ada yang perlu diunduh, tidak ada kota yang perlu dirawat di
   server. Yang dulu terlihat seperti kebutuhan API ternyata kebutuhan **rumus**.
2. Sudah ada preseden jelas di repo ini untuk "hitung lokal, bukan panggil jaringan":
   ADR-004 (bundle konten penuh) memilih offline karena jaringan adalah jenis
   kegagalan yang paling sering terjadi pada user Indonesia.

Permintaan user: "tambah fitur arah kiblat, reminder sholat, dll". Jadi cakupannya:
jadwal salat, arah kiblat, pengingat waktu salat.

## Keputusan

Enam bagian, satu tema: **semuanya dihitung atau dijadwalkan di device, tanpa API
baru, tanpa server.**

1. **Waktu salat lewat `adhan` (MIT), metode Kemenag RI.** Sudut Subuh 20°, Isya 18°,
   Ashar bayangan 1×. Sumber kebenaran angkanya ada di
   [times.ts](../../src/core/prayer/times.ts) sebagai modul PURE (input angka, output
   angka). **Ihtiyati 2 menit** ditambahkan pada lima waktu salat — bukan syuruq — arah
   kesalahan yang aman untuk ibadah: jadwal yang tampil tidak pernah lebih awal dari
   hasil perhitungan.
2. **Zona waktu ikut LOKASI, bukan device.** Device Indonesia sering diset WIB
   walaupun fisiknya di Makassar/Jayapura; kalau offset device yang dipakai, jadwalnya
   salah satu jam. Karena itu `tzOffsetMinutes` adalah input wajib modul waktu salat.
3. **Kiblat = bearing great-circle dari koordinat ke Ka'bah (21,4225 ; 39,8262),
   TANPA kompas.** Yang ditampilkan adalah sudut dari utara sebenarnya + jarak ke
   Ka'bah. Ini sengaja: arah kompas adalah nilai yang paling mudah salah (interferensi
   magnetik, device yang belum dikalibrasi) dan **tidak bisa di-QA sama sekali di web**
   — sensor tidak ada di sana. Angka sudut tidak berpura-pura tahu lebih dari yang ia
   tahu, dan bisa diuji terhadap nilai acuan di test.
4. **Lokasi: GPS device (native) dengan fallback daftar 38 ibu kota provinsi.**
   `expo-location` hanya dipakai untuk *foreground* fix — tanpa reverse geocoding,
   tanpa panggilan jaringan. Zona waktu untuk titik GPS diambil dari **ibu kota
   terdekat yang dikenal** (jarak great-circle), bukan dari device: itu tetap benar
   offline, dan untuk seluruh Indonesia jaraknya pendek sehingga zonanya tepat. Di web
   (dan bila izin ditolak) user memilih kota dari daftar; layar tetap berfungsi penuh.
5. **Pengingat salat = notifikasi lokal harian**, lewat adapter yang sudah ada
   ([reminder-scheduler.ts](../../src/features/reminders/reminder-scheduler.ts) —
   satu-satunya berkas yang menyentuh `expo-notifications`), dengan channel Android
   sendiri (`ayatin-prayer`). Lima waktu, izin diminta saat user menyalakan toggle
   (pola yang sama dengan pengingat ngaji). Jadwal OS **diperbarui setiap app dibuka**;
   signature jadwal disimpan supaya penyelarasan berulang tidak membuat duplikat.
   Web = no-op bersih.
6. **Area 6 (kalender Hijriah) tetap ditolak.** Ia butuh kriteria hisab/rukyat yang
   berbeda-beda antar ormas — itu perdebatan, bukan perhitungan. Kalau nanti diadopsi,
   ia butuh ADR sendiri.

## Akurasi: apa yang diukur, dan seberapa

Referensi uji: **Aladhan API `method=20`** (Kementerian Agama RI), `school=0`. Dipilih
karena ia metode yang sama persis (20°/18°, Ashar 1×) dan tersedia publik, jadi angka
pembandingnya bisa diperiksa orang lain — bukan tabel buatan sendiri.

Empat kota, dua tanggal ekstrem (Oktober & Desember, kedekatan ekuinoks/titik balik
matahari):

| Kota | Tanggal | Subuh | Syuruq | Dzuhur | Ashar | Maghrib | Isya |
|---|---|---|---|---|---|---|---|
| Jakarta (−6,1754 ; 106,8272) | 5 Okt 2026 | 04:18 | 05:36 | 11:41 | 14:43 | 17:47 | 18:56 |
| Jakarta | 21 Des 2026 | 04:11 | 05:36 | 11:51 | 15:18 | 18:05 | 19:21 |
| Banda Aceh (5,5483 ; 95,3238) | 5 Okt 2026 | 05:09 | 06:26 | 12:27 | 15:43 | 18:29 | 19:38 |
| Banda Aceh | 21 Des 2026 | 05:19 | 06:43 | 12:37 | 15:59 | 18:31 | 19:46 |
| Makassar (−5,1477 ; 119,4327) | 5 Okt 2026 | 04:28 | 05:46 | 11:51 | 14:52 | 17:56 | 19:05 |
| Makassar | 21 Des 2026 | 04:22 | 05:47 | 12:00 | 15:27 | 18:13 | 19:29 |
| Jayapura (−2,5916 ; 140,6691) | 5 Okt 2026 | 04:05 | 05:22 | 11:26 | 14:32 | 17:30 | 18:39 |
| Jayapura | 21 Des 2026 | 04:03 | 05:27 | 11:35 | 15:02 | 17:43 | 18:59 |

Hasilnya diukur dalam **dua angka terpisah**, karena keduanya menjawab pertanyaan
yang berbeda:

| Yang diukur | Hasil | Artinya |
|---|---|---|
| Hasil mentah (tanpa ihtiyati) vs referensi | selisih terbesar **2 menit**, mayoritas 0 | ketelitian perhitungan setara sumber acuan |
| Jadwal yang tampil (mentah + ihtiyati 2) vs referensi | rentang **0 sampai +4 menit** | pengaman hanya pernah **memundurkan**, tidak pernah memajukan |

Yang penting bukan "≤ 2 menit"-nya, tapi **arahnya**: jadwal yang ditampilkan tidak
pernah lebih awal dari referensi, karena itulah risiko yang nyata dalam ibadah
(menunaikan salat sebelum waktunya). Sumber referensinya sendiri tidak memakai
ihtiyati, jadi selisih 2 menit di hasil mentah adalah pembulatan detik + beda
pembulatan, bukan rumus yang salah.

Test [times.test.ts](../../src/core/prayer/times.test.ts) menegakkan keduanya per
kota per tanggal (bukan satu tabel "kira-kira"): batas 2 menit untuk hasil mentah,
dan syarat "tidak pernah lebih awal" untuk yang tampil. Ada juga test terpisah yang
membuktikan ihtiyati benar-benar ditambahkan tepat 2 menit pada lima waktu salat dan
**tidak** pada syuruq (syuruq bukan waktu salat). Angka mentah sengaja tidak
diperlonggar sampai 4 menit: bug rumus yang nyata (Ashar meleset belasan menit)
justru akan lolos kalau ambangnya disetel supaya semua warna hijau.

Angka kiblat juga diuji terhadap nilai acuan: Jakarta 295,1461° · Banda Aceh
292,1663° · Makassar 292,4769° · Jayapura 291,3263° (bearing great-circle, utara
sebenarnya).

## Batas yang diakui (jangan dibaca sebagai "sudah selesai")

- **GPS dan kompas belum pernah diuji di device fisik.** Yang bisa diuji di repo ini
  adalah modul PURE-nya dan kontrak adapter-nya (web tidak menyentuh `expo-location`,
  semua kegagalan jadi nilai balik). QA web memakai jalur fallback kota. Ini alasan
  kiblat dirilis sebagai **sudut**, bukan panah kompas: satu klaim jujur lebih baik
  daripada satu UI yang belum bisa dibuktikan.
- **Jadwal OS bergeser halus.** Waktu salat bergerak ~1 menit per hari; jadwal
  notifikasi diperbarui saat app dibuka. Kalau user tidak membuka app selama beberapa
  hari, pengingatnya bisa meleset beberapa menit — bukan jam.
- **Zona waktu dari kota terdekat** berarti titik GPS yang jauh dari ibu kota mana pun
  (mis. perbatasan, atau luar negeri) bisa dapat zona tetangga terdekatnya. Untuk
  penggunaan di Indonesia arus utama, jaraknya pendek.
- **Ini alat bantu, bukan sumber otoritatif.** Jadwal masjid/Kemenag setempat tetap
  acuan; UI menyebut metode + ihtiyati supaya user tahu asal angkanya.

## Yang ditolak

- **API waktu salat (Aladhan/equran.id online).** Diganti panggilan jaringan untuk
  fungsi yang bisa dihitung lokal; bertabrakan dengan ADR-004 dan menambah titik gagal
  baru tanpa menambah ketelitian (referensi ujinya sendiri sudah menunjukkan kita
  setara).
- **Hitungan sendiri tanpa library.** Prototipe mandiri sempat dibuat: Ashar meleset
  7–40 menit dari referensi dan ihtiyati/zona hanya benar di sebagian jalur. Rumus
  matahari mudah terlihat benar di satu kota dan salah di kota lain — buang.
- **Kompas sekarang.** Sensor tidak bisa diuji di CI/web; merilis janji yang tak
  terverifikasi itu bertentangan dengan BRAND § 4.
- **Reverse geocoding / nama kota dari koordinat** (butuh jaringan) — label lokasi
  cukup "sekitar <ibu kota terdekat>".
- **Kalender Hijriah** (Area 6) — perdebatan kriteria, bukan perhitungan.

## Kapan keputusan ini dibuka kembali

- Ada device fisik untuk QA → tambahkan kompas (magnetometer + kalibrasi) sebagai
  pengganti/pelengkap sudut, dan uji akurasi GPS di luar ruangan.
- Butuh akurasi resmi per kota (mis. ihtiyati 0 vs 2 menit mengikuti kebijakan
  masjid) → jadikan ihtiyati sebagai pengaturan user, tabel kota tetap dipakai untuk
  uji.
- Kalender Hijriah diminta → ADR terpisah dengan kriteria & sumber yang eksplisit.
- Lisensi konten tafsir dibahas → ADR terpisah (bukan di sini).
