# Brand — Meowalaf

> **Status**: v1.0 · **Tanggal**: 2026-10-04 · Companion: [DESIGN.md](DESIGN.md), [RULES.md](RULES.md), [PRD.md](PRD.md)
>
> Dokumen ini mencatat **riset, keputusan, dan konsekuensi** rebranding dari "Ayatin" ke
> **Meowalaf** — kucing islami yang menemani mualaf belajar Al-Quran. Semua angka & tautan
> riset di sini bisa diperiksa ulang; semua keputusan teknis punya alasan yang bisa dibantah.

## 1. Riset: meowslim.id (pembanding terdekat)

Sumber: halaman publik `https://www.meowslim.id/en/` dan listing Google Play
`Meowslim: Ibadah & Bebas Iklan` (YSTUDIO, diperbarui 19 Sep 2026, 5.0★ / 36 ulasan,
500+ unduhan). Dibaca 4 Okt 2026.

**Apa yang mereka bangun.** Bukan aplikasi belajar, tapi **pendamping ibadah harian**:
Quran 30 juz lengkap + murottal per ayat + tafsir + Yasin terpisah + bookmark, kumpulan doa
harian + Asmaul Husna, jadwal salat otomatis + alarm adzan + kompas kiblat, kalender Hijriah,
tasbih digital, tracker ibadah + catatan pribadi + kutipan islami harian, XP/level untuk
konsistensi dzikir, mode terang & gelap, dan klaim bebas iklan.

**Apa yang layak ditiru (dan sudah kita pakai sebagian).**

| Pelajaran | Keputusan Meowalaf |
|---|---|
| Nama hewan + nuansa islami ("Meow" + ibadah) terbukti diterima pasar Indonesia | Nama **Meowalaf** melanjutkan pola yang sama, tapi dengan premis belajar (mualaf), bukan pendamping ibadah |
| XP/level dipakai untuk hal non-permainan (dzikir) → "membuat ibadah harian lebih menyenangkan" | Kita sudah punya XP/level/streak untuk lesson; rebranding hanya mengganti bahasa visualnya (jejak kaki, bukan api) |
| "Kutipan islami harian" jadi kebiasaan buka app | Diadopsi sebagai **"Nasihat Abu"** — tips kebiasaan ngaji yang rotasi per hari WIB |
| Ulasan memuji "desainnya beda dari yang lain dan lengkap" | Pembedaan kita: **satu teman belajar (maskot) yang konsisten**, bukan kumpulan fitur |
| Diiklankan "ringan, rapi, nyaman", mode terang & gelap | Kita tetap dark-first (DESIGN § 1) + jalur ringan (bundle 1,98 MB gzip, budget startup di [PERF.md](PERF.md)) |

**Apa yang sengaja TIDAK ditiru.** Jadwal salat/adzan/kiblat/kalender Hijriah: itu
produk lain dengan biaya perawatan besar (data lokasi, algoritma waktu salat, izin
notifikasi alarm) dan tidak meningkatkan inti kita (belajar bertahap + retensi). Kalau
nanti diadopsi, harus jadi ADR sendiri dengan sumber data & uji akurasi — bukan tempelan.

**Pembaruan 5 Okt 2026.** Syarat itu dijalankan untuk jadwal salat & arah kiblat:
[ADR-010](adr/ADR-010-jadwal-salat-kiblat-pengingat.md) — semuanya dihitung lokal (tanpa
API), kiblat dirilis sebagai sudut tanpa kompas, dan uji akurasinya ditulis di sana.
Adzan audio & kalender Hijriah tetap di luar lingkup, dengan alasannya masing-masing.

**Posisi Meowalaf.** Meowslim menemani orang yang **sudah** beribadah; Meowalaf menemani
orang yang **baru mulai** — premisnya di nama: *Meow + Mualaf* = kucing yang baru belajar
agama. Karena itu nada copy sedikit lebih sabar dan tidak pernah menghukum pemula
(lihat § 5 dan [DESIGN.md](DESIGN.md) § 5).

## 2. Riset: kucing dalam tradisi Islam

Ini bukan sekadar "hewan lucu yang dipakai jualan" — kucing punya tempat khusus, dan itu
yang membuat premisnya bertahan lama:

- **Abu Hurayrah** ("bapak kucing kecil") adalah julukan sahabat Nabi yang paling banyak
  meriwayatkan hadis; julukan itu datang dari kebiasaannya membawa kucing kecil.
- Beberapa riwayat menceritakan kasih sayang Nabi kepada kucing (antara lain kisah kucing
  yang tidur di kain beliau sehingga beliau memotong kainnya daripada mengusiknya).
- Dalam banyak pembahasan fikih, kucing termasuk hewan yang tidak dianggap najis,
  sehingga ia sering hadir di rumah & masjid sejak dulu.
- Konsekuensi desain: **maskot kucing = keputusan yang aman dan bermakna**, bukan simbol
  yang dibuat-buat. Yang harus hati-hati justru budayanya (§ 6): jangan menjadikan simbol
  ibadah sebagai kostum lucu.

## 3. Riset: pemilihan ikon & bentuk maskot

**Acuan gaya (bukan untuk disalin).** Pemilik produk memberi satu ilustrasi acuan: kucing
abu-abu duduk, mata senyum tertutup, memakai peci biru, memeluk kitab terbuka, di atas
sajadah dengan lengkung mihrab emas. Ilustrasi itu **stok berwatermark (Shutterstock, ID
2730774711)** — jadi yang diambil hanya **arah gaya**: kucing abu, mata senyum, peci, kitab.
Bentuk akhirnya digambar sendiri di repo (SVG untuk in-app, rasterizer untuk ikon) tanpa
satu pun aset dari gambar itu, dan tanpa menyalin komposisinya (sajadah & mihrab tidak
dipakai — lihat § 6).

**Kandidat warna yang diuji lewat mata, bukan selera** (digambar lalu dibandingkan pada
ukuran 48/64/128 px):

| Kandidat | Plus | Minus | Keputusan |
|---|---|---|---|
| **British Shorthair abu-abu** (bulu `#98A4AD`, mata tembaga, moncong krem, pipi chubby) | Siluet bulat + telinga kecil = kebaca kucing bahkan di 48 px; abu tidak bertabrakan dengan emerald/gold; "abu" sekaligus nama maskot | Abu bisa terlihat datar kalau tanpa moncong lebih terang → moncong krem wajib | **Dipilih sebagai maskot utama (Abu)** |
| **Kucing putih** (bulu `#F2EEE6`) | Kontras tinggi di latar gelap; bersih | Menyatu dengan teks putih UI; di ikon adaptif warna terang mudah "hilang" saat di-crop bulat | **Varian** (`variant="cream"`), bukan default |
| **Versi v1 (kepala dari susunan `View`)** | Nol dependency | Tidak bisa menggambar kurva → mata senyum/ekor/kitab jadi kotak; maskot terbaca seperti hamster | **Diganti** 4 Okt 2026 setelah masukan pemilik produk: masuk ke `react-native-svg` (bawaan Expo Go) dan digambar ulang sebagai kucing duduk |
| Kucing oranye/calico | Ceria | Bertabrakan dengan aksen flame/gold; lebih dekat ke brand lain | Tidak dipakai |
| Emoji kucing (🐱/🐈) | Nol kustom | Warnanya beda per platform (Android vs iOS vs Windows) dan tidak bisa diwarnai token | Tidak dipakai — maskot digambar dari View |

**Motif ornamen yang dipakai & dihindari.**

- Dipakai: **bulan sabit + bintang empat** (kecil, di sudut), **peci biru** dengan pita
  krem & tiga belah ketupat emas, palet emas sebagai aksen islami, dan **kitab terbuka**
  yang dipeluk Abu (halaman **kosong** — tidak pernah ada teks Arab palsu).
- Dihindari: **gerakan ibadah pada kucing** (sujud, rukuk, gerakan salat), **sajadah/
  mihrab** sebagai latar komponen, kaligrafi sebagai hiasan, dan emoji menyentuh ayat
  (sudah ada di [RULES.md](RULES.md) § 7.5).
- Alasan singkat: peci itu **pakaian** sehari-hari Muslim Indonesia, bukan peniruan ritual
  — keputusan produk 4 Okt 2026 (sebelumnya sempat dilarang di dokumen ini). Yang tetap
  dilarang: kucing yang **meniru gerak ibadah**, dan teks suci yang digambar palsu di
  ornamen/kitab maskot.
- Lisensi: **semua bentuk digambar di repo ini** (`scripts/brand/render-icons.mjs`) dan
  maskot digambar dari `View` (`src/ui/components/CatMascot.tsx`) — tidak ada aset pihak
  ketiga, tidak ada pertanyaan lisensi (RULES § 7.8). Referensi visual hanya dipakai
  sebagai *tujuan gaya*, tidak pernah diunduh ke repo.

## 4. Identitas

| Elemen | Nilai | Catatan |
|---|---|---|
| Nama app | **Meowalaf** | "Meow" + "Mualaf"; ditulis tanpa spasi, tidak diterjemahkan |
| Maskot | **Abu** | British Shorthair abu-abu, duduk memeluk kitab, memakai peci biru. Nama diri: sama di id & en |
| Tagline (id) | "belajar Quran pelan-pelan, bareng Abu" | `brand.tagline` |
| Tagline (en) | "learn the Quran step by step, with Abu" | kunci yang sama |
| Sapaan maskot | "assalamu'alaikum!" + perkenalan singkat | `brand.mascotIntro` |
| Aksen kucing | jejak kaki (`CatPaw`) menggantikan api 🔥 di badge streak | streak = jejak yang ditinggalkan tiap hari |
| Aksen islami | emas `#E0B44A` (bulan sabit, bintang) | juga warna notifikasi Android (`app.json`) |
| Tipografi | **Poppins** (Regular + Bold) | Geometric sans, gratis (OFL); satu keluarga untuk body dan judul supaya membaca jadi tenang seperti mascot |
| Tipografi fallback | **Amiri** (Arab) · **Noto Sans** (transliterasi) | Bukan pilihan branding, hanya menutup glyph yang Poppins tidak punya — 12 glyph transliterasi (DESIGN § 3) |

### Perubahan nama: apa yang berubah, apa yang TIDAK

| Hal | Keputusan | Alasan |
|---|---|---|
| `app.json`: `name`, `slug`, `scheme`, `android.package` | **Berubah** → `Meowalaf`, `meowalaf`, `meowalaf`, `id.meowalaf.app` | Belum pernah dirilis (versionCode 1, APK belum pernah dibuat — lihat [ROADMAP.md](ROADMAP.md)); mengganti package setelah rilis akan memutus rantai upgrade |
| Kunci storage (`ayatin-profile-v1`, `ayatin-quests-v1`, `ayatin.db`, …) | **TIDAK berubah** | Progres user sudah nyata (QA & device). Mengganti kunci = semua progres hilang, dan itu kerugian nyata demi kosmetik. Migrasi nama bisa dilakukan sendiri nanti dengan copy-then-verify |
| `README`/docs judul | Berubah | Dokumentasi, bukan data |
| Nama file/folder | Tidak berubah | Tidak ada nilainya, hanya memperbesar diff |

## 5. Peta redesign (apa yang berubah di layar)

| Layar/fitur | Sebelum | Sesudah |
|---|---|---|
| Onboarding | emoji burung 🐦 + "gaskeun mulai — 5 menit doang 😤" | maskot Abu (mood `happy`, bulan sabit, `pose="wave"` + `entrance="walk"`) + nama app + "bismillah — mulai dari nol juga gapapa" |
| Home | sapaan + target + quest + terakhir dibaca | kartu **"Hadis hari ini"**: matn Arab + terjemahan + atribusi (rawi · HR. Bukhari/Muslim), rotasi per hari WIB (`src/features/home/hadith.ts`). **Tanpa maskot** — teks suci tidak boleh punya maskot di sisinya (§ 6.1), jadi kartu nasihat + Abu yang lama dihapus |
| Streak | "🔥 3" | jejak kaki `CatPaw` + "3" di Home, hasil lesson, dan kartu streak |
| Tab bar | ikon `home` | ikon **`paw`** (keluarga Ionicons yang sama — tidak ada font ikon baru) |
| Empty state | emoji default 🐦 | maskot default (mood `sleepy`); `emoji` tetap bisa dipakai untuk kasus spesifik (mis. 🔍 pencarian) |
| Hasil lesson | emoji burung yang melompat | **Abu melompat** (mood `cheer` kalau sempurna, `happy` kalau tidak) — animasi & reduced-motion tidak berubah |
| Feedback tiap soal | hanya teks verdict | **Abu bereaksi** ("bener" → `cheer`, benar dengan hint → `happy`, salah → `encourage` dengan mata terbuka) + satu kalimat penyemangat yang bergilir per posisi soal (`features/lessons/reaction.ts`) |
| Ikon app (semua platform) | aset lama | digambar ulang: Abu + bulan sabit + bintang di atas gradien gelap-emerald |

Urutan prioritas saat layar sempit dipertahankan: kartu maskot diletakkan **setelah** CTA
"Lanjut Ngaji" dan quest, supaya tombol utama tetap di atas fold (DESIGN § 4).

## 6. Aturan adab (yang tidak boleh dilanggar maskot)

1. Maskot **tidak pernah** muncul di dalam/di samping teks ayat, nama surah, atau metadata
   mushaf — sama seperti larangan emoji di [RULES.md](RULES.md) § 7.5.
2. Maskot hanya di **meta-experience**: onboarding, empty state, hasil lesson, badge
   streak, dan feedback latihan. **Tidak** lagi di Home — sejak Home memuat teks hadis
   (§ 6.1), dan teks suci tidak boleh punya maskot di sampingnya.
3. Copy yang menyentuh ayat/ibadah tetap formal; hanya *framing* yang lucu
   ("aku nemenin kamu", "pelan-pelan aja").
4. Ibadah bukan kostum: tanpa peci, tanpa gerakan salat, tanpa sajadah sebagai properti.
5. **Hadis harian** (`hadith.*`) wajib **shahih**, dari Bukhari/Muslim, dan **tidak pernah
   tanpa atribusi**: rawi + collection + nomor, menempel pada teks. Kelengkapan attribusinya
   dijaga otomatis — `features/home/hadith.test.ts` gagal kalau satu entri kehilangan nomor
   atau menyebut selain Bukhari/Muslim — tapi **kebenaran nomor hadis dan ketepatan matn
   tidak bisa dicek test mana pun**, jadi review manusia sebelum rilis publik (RULES § 7.7)
   di sini bukan formalitas. Matn juga tidak boleh dipotong atau diringkas supaya muat
   kartu; kalau kepanjangan, ganti hadisnya. Bagian lama aturan ini (copy meta-experience
   hanya soal kebiasaan, bukan fatwa/tafsir) tetap berlaku untuk tip & kalimat lain.
6. Nama maskot bukan nama sahabat/nabi: "Abu" dipilih karena sekaligus berarti *abu*
   (warna bulunya). Referensi Abu Hurayrah tetap disebut di dokumen ini sebagai dasar
   budaya, **tidak** diklaim sebagai representasi beliau.
7. **Di feedback latihan** Abu duduk di **baris verdict** (momen meta: "bener"/"belum
   tepat") plus satu kalimat penyemangat. Terjemahan ayat selalu dipisah garis di
   bawahnya, jadi tidak ada maskot yang menempel pada ayat — dan kalimat untuk jawaban
   salah **tidak boleh menghakimi** ("gagal", "harusnya"): audiensnya pemula, dan
   kesalahan adalah bagian dari desain belajar. Aturannya hidup di
   `src/features/lessons/reaction.ts` + dijaga test nadanya.

## 7. Ikon app: spesifikasi & pipeline

```
npm run brand:icons      # tulis ulang assets/*.png (deterministik)
npx vitest run scripts/brand/render-icons.test.ts
```

- Isi ikon = karakter yang sama dengan maskot in-app (kucing duduk + peci + kitab +
  sabit), pada peta koordinat 0–200 yang sama dengan `CatMascot.tsx`.
- Generator: [scripts/brand/render-icons.mjs](../scripts/brand/render-icons.mjs) — bentuk
  vektor + supersampling 4×4, ditulis ke PNG oleh
  [scripts/brand/png.mjs](../scripts/brand/png.mjs) (zlib bawaan Node, **tanpa dependency
  baru**; `pngjs`/`jimp` yang ada di `node_modules` itu dependency turunan, bukan milik repo).
- Berkas yang dihasilkan: `icon.png` 1024 · `favicon.png` 48 · `splash-icon.png` 1024
  (transparan) · `android-icon-foreground.png` 512 (transparan, aman di safe zone 66 %) ·
  `android-icon-background.png` 512 · `android-icon-monochrome.png` 432 (siluet putih).
- Guard [scripts/brand/render-icons.test.ts](../scripts/brand/render-icons.test.ts): dimensi
  harus cocok `app.json`, latar ikon opak & gelap, bulu abu/moncong krem/mata tembaga/bulan
  sabit emas harus ada di koordinat yang diharapkan, ikon transparan benar-benar transparan
  di tepi, dan **berkas di `assets/` harus identik dengan hasil render saat ini** (kalau
  bentuk diubah tanpa menjalankan generator, test gagal).
- Menambah emoji baru ke UI tetap harus lewat allow-list
  [scripts/fonts/subset-fonts.test.ts](../scripts/fonts/subset-fonts.test.ts): karakter di
  komentar pun ikut terhitung sebagai inventaris glyph (pernah kejadian saat rebranding ini).

## 8. Pose, animasi & pratinjau maskot

Abu punya **2 pose** dan **2 entrance**, plus gerakan terus-menerus:

| Yang | Apa yang terlihat | Angka (sumber: `CAT_MOTION`) |
|---|---|---|
| `pose="sit"` (default) | duduk memeluk kitab, seperti sebelumnya | — |
| `pose="wave"` | duduk sambil melambai dengan kaki depan **kiri** | ayunan ±7° dari pangkal lengan, 460 ms loop |
| `entrance="none"` (default) | langsung tampil | — |
| `entrance="walk"` | berjalan masuk dari kiri: geser 0,55 × ukuran + dua langkah kecil + pudar | 700 ms, sekali per sesi app |
| loop mata | berkedip, hanya saat mata terbuka (`idle` & `encourage`) | jeda 2,6 s → tutup 110 ms → buka 150 ms |
| loop ekor + napas | selalu, kecuali `cheer` yang lebih cepat | 1,7 s & 2,9 s (cheer 0,9 s & 1,3 s) |

Tiga keputusan yang lahir dari bug nyata, bukan dari selera:

1. **Melambai pakai kaki depan KIRI.** Versi pertama mengangkat kaki kanan, dan
   hasilnya: lengung lengan berwarna bulu yang sama seperti badan sehingga hilang begitu
   menutupi badan, dan posisinya menabrak lengkung ekor. Melambai di sisi tanpa ekor membuat
   lengan terbaca sebagai lengan. Ketahuan dari pratinjau visual, bukan dari test.
2. **Kedip hanya untuk mood bermata terbuka.** Mata senyum (`happy`/`cheer`) sudah
   tertutup; membuat layer matanya beranimasi hanya akan membuat wajah bergetar aneh.
   Aturannya di data (`blinkable` per layer), bukan di komponen.
3. **Sapaan berjalan masuk hanya sekali per sesi app.** Penyimpanannya di modul
   (`CatMascot.tsx`), bukan `useRef`, justru supaya bertahan ketika layar di-render
   ulang — kalau tidak, "sapaan" berubah jadi kedutan berulang.

**Reduced-motion bukan pengurangan kualitas, tapi pilihan yang benar.** Saat setelan aksesibilitas
mengaktifkannya: tidak ada kedip, napas, ayunan, lambaian, atau animasi masuk —
Abu tampil langsung di posisi netral. Cara mengujinya tanpa mengubah setelan OS:
`npm run brand:mascot-preview` menulis juga `dist/_brand/app-reduced-motion.html`,
yaitu app asli dengan `prefers-reduced-motion: reduce` dipaksa aktif **sebelum**
bundle-nya jalan (settings OS dibaca Reanimated saat modulnya dimuat, jadi
override harus mendahului script app).

```
npm run brand:mascot-preview   # -> dist/_brand/mascot-preview.html + app-reduced-motion.html
```

Pratinjaunya menampilkan 24 kombinasi (6 mood × 2 pose × 2 varian bulu), strip
ukuran yang benar-benar dipakai app (56/76/84/104/116 px), tombol ulang animasi
masuk, dan sakelar mode diam. Seluruh gambarnya datang dari `catScene()` — modul
yang sama dengan app — dan durasinya dari `CAT_MOTION`, jadi halaman pratinjau
tidak bisa menyimpang dari yang dilihat user. Guard:
[scripts/brand/mascot-preview.test.ts](../scripts/brand/mascot-preview.test.ts).

Adab yang tetap berlaku di pose baru: melambai itu **sapaan**, bukan gerakan ibadah;
tidak ada sujud, mihrab, berdiri menunduk, atau gerakan salat yang ditiru, dan teks Arab palsu
tetap tidak ada di kitab maupun ornamen.

## 9. Yang belum dikerjakan (jujur, bukan klaim)

- **Pose ilustrasi penuh**: yang ada sekarang adalah satu gaya (kepala + 6 mood) dengan
  2 pose dan animasi vektor. Pose seperti "berjalan benar-benar" (empat kaki), "duduk di
  sajadah", atau latar bento bergambar tetap pekerjaan ilustrasi terpisah — bukan
  menambah bentuk acak di komponen.
- **Light mode**: masih dark-first ([DESIGN.md](DESIGN.md) § 1). Palet kucing sudah punya
  kontras yang cukup untuk nanti, tapi belum diuji di latar terang.
- **Ikon adaptif Android & splash di device sungguhan**: hanya diverifikasi sebagai berkas
  (dimensi + warna), belum lewat build APK — masih terkunci akun Expo (lihat ROADMAP).
- **Nama produk final** di [PRD.md](PRD.md) § lampiran: keputusan manusia; dokumen ini
  mencatat pilihan yang dipakai kode sampai ada keputusan lain.
