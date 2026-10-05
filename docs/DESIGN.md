# Design — Meowalaf

> **Status**: v1.1 · **Tanggal**: 2026-10-04 · Companion: [PRD.md](PRD.md), [ARCHITECTURE.md](ARCHITECTURE.md), [RULES.md](RULES.md), [BRAND.md](BRAND.md)

Design system bergaya **Gen Z Indonesia**: gelap, berani, playful — dengan satu batasan tak ternegosiasi: **konten Quran tidak pernah menjadi bahan percandaan** (aturan copy di § 5, adab di [RULES.md](RULES.md) § 7 dan [BRAND.md](BRAND.md) § 6).

## 1. Art Direction

> "Dark mode masjid vibe" — hangat, energik, tidak klise hijau pekat penuh ornamen.

- **Dark-first** (default), light mode menyusul di v1.1.
- Gradient vibrant sebagai identitas: emerald → teal untuk hal-hal "positif/naik", violet → pink untuk "reward/seru".
- Glassmorphism ringan untuk kartu (blur halus, border 1px putih 10%), bukan sekadar flat.
- Bentuk: radius besar (20–28px), komposisi bento-grid di Home, ilustrasi 2D flat bergaya geometris untuk mascot (tanpa file gambar — lihat § 7).
- **Mascot**: kucing British Shorthair abu-abu bernama **Abu** — "kucing mualaf" yang menemani dari nol: duduk memeluk kitab kecil, memakai peci biru, mata senyum tertutup. Muncul di onboarding, empty state, badge streak, hasil lesson, dan feedback latihan. **Tidak pernah** di sekitar ayat/nama surah/metadata mushaf — termasuk **tidak** di kartu hadis Home.
- **Aksen islami**: bulan sabit + bintang kecil berwarna emas dan peci (pakaian, bukan properti ritual), dipakai hemat — satuan ornamen, bukan pola penuh. Yang tetap dilarang: kucing meniru gerakan ibadah, sajadah sebagai latar, dan teks suci yang digambar palsu ([BRAND.md](BRAND.md) § 6).

## 2. Design Tokens (`src/ui/tokens.ts`)

### Warna
| Token | Nilai | Pakai untuk |
|---|---|---|
| `bg/base` | `#0B0F0E` | Latar utama |
| `bg/elevated` | `#141B19` | Kartu, sheet |
| `bg/glass` | `rgba(255,255,255,0.06)` + blur | Kartu glass |
| `brand/emerald` | `#10B981` | Primer: progress, XP, CTA |
| `brand/teal` | `#14B8A6` | Gradient pasangan emerald |
| `brand/violet` | `#8B5CF6` | Reward, achievement |
| `brand/pink` | `#EC4899` | Aksen streak, konfeti |
| `streak/flame` | `#F97316` | Api streak |
| `text/primary` | `#F4F7F6` | Teks utama |
| `text/secondary` | `#9CA8A4` | Teks sekunder |
| `arab/default` | `#EAF2EF` | Teks ayat (kontras penuh, selalu terang) |
| `feedback/success` | `#34D399` | Jawaban benar |
| `feedback/danger` | `#F87171` | Jawaban salah |
| `feedback/warn` | `#FBBF24` | Hint, peringatan |
| `cat/ash` | `#98A4AD` | Bulu maskot Abu (BSH abu-abu) |
| `cat/ash-deep` | `#78858F` | Bayangan bulu |
| `cat/cream` | `#F2EEE6` | Moncong & dada; varian kucing putih |
| `cat/blush` | `#E79F9A` | Hidung, pipi, telinga dalam |
| `cat/eye` | `#D08A3E` | Mata tembaga khas BSH |
| `cat/ink` | `#232B2F` | Garis mulut, kumis, pupil |
| `gold` | `#E0B44A` | Aksen islami: bulan sabit, bintang |

Prinsip: warna brand TIDAK PERNAH dipakai mewarnai teks ayat — ayat selalu netral terang di atas `bg/base` atau `bg/elevated`.

### Radius, spacing, elevasi
- Radius: `sm 12 · md 20 · lg 28 · pill 999`.
- Spacing skala 4pt: `4 8 12 16 20 24 32 40`.
- Elevasi: shadow lembut + border `1px rgba(255,255,255,0.08)`; di web pakai `backdrop-filter` untuk glass (fallback solid di browser tua).

## 3. Tipografi

| Peran | Font | Token | Catatan |
|---|---|---|---|
| Body | **Poppins** Regular | `--font-sans` | Geometric sans, gratis (OFL) |
| Judul & angka besar | **Poppins** Bold | `--font-display` | Untuk angka besar (XP, streak), logo |
| Transliterasi Arab | **Noto Sans** Regular | `--font-translit` | Fallback **per kata** — hanya untuk Ḥ ḣ Ṣ ṣ Ṭ ṭ ẓ + macron + ʻ |
| Arab | **Amiri** (fallback: Scheherazade New, sistem) | `--font-arab` | Dibundle; ukuran bisa diatur user S/M/L |

Poppins tidak punya satu pun dari 12 glyph transliterasi yang dipakai terjemahan ayat,
jadi `TransliteratedText` membungkus tiap **kata** ber-transliterasi dengan
`--font-translit`. Kalau fallback dipasang di level elemen, "Alif Lām Mīm Ṣād." jadi
campuran dua typeface yang berbeda tinggi-x di tengah kalimat; dibungkus per kata,
baris tetap terbaca sebagai satu typeface dan hanya glyph yang hilang yang berganti.
Daftarnya dikunci dua arah oleh `scripts/fonts/transliteration-font.test.ts`:
karakter yang Poppins tidak punya **wajib** ada di Noto Sans, dan karakter yang
Poppins punya **dilarang** ikut di-subset (membuang byte sekaligus mencampur typeface
tanpa alasan).

Bobot tipografi dipilih lewat **file font** (`Poppins-Regular` vs `Poppins-Bold`),
bukan `font-weight`: tidak ada satu pun `font-weight`/`font-bold` di app, dan hanya
dua weight itu yang dibundel — weight lain hanya menambah byte splash tanpa pernah
dirender. Konsekuensinya, skala di bawah memakai `bold`, bukan `semibold`.

Poppins lebih lebar dari Plus Jakarta Sans yang sebelumnya dipakai, jadi Home,
lesson, mushaf, dan profil diperiksa ulang untuk overflow & truncation.

Skala (Latin): `display 32/40 bold · h1 24/32 bold · h2 20/28 bold · body 16/24 · label 14/20 · caption 12/16`.
Arab: `S 22px · M 28px · L 34px` dengan `lineHeight ×1.9`, arah RTL, tanpa letter-spacing tambahan.

## 4. Layout & Navigasi

- **Bottom tab bar** (Home · Mushaf · Profil) di mobile; di web tetap bottom bar (max-width 480px, centered) — konsisten dengan pengalaman HP.
- Home = **bento-grid**: kartu streak (besar), progress ring harian, quest list, kartu "Lanjut Ngaji" (CTA utama, selalu di atas fold).
- Lesson: full-screen focus mode, satu elemen per layar, tombol utama di bawah (safe area).
- Mushaf: card per surat di list; ayat di detail ditampilkan per blok (Arab di atas, terjemahan di bawah, nomor ayat dalam kapsul kecil).
- Touch target minimum **44×44px**; safe area iOS & gesture bar Android dihormati di semua screen.

## 5. Copywriting (Bahasa Gen Z, dengan garis merah)

**Garis merah (aturan lengkap di [RULES.md](RULES.md) § 7)**: copy yang *menyentuh ayat, nama surah, atau ibadah* selalu formal & hormat. Santai hanya untuk meta-experience (progres, streak, fitur).

### Tone & contoh
| Konteks | ✅ Contoh | ❌ Hindari |
|---|---|---|
| Onboarding | "gaskeun mulai — 5 menit doang, jan laper mata 😤" | "Ayuk mulai belajar Quran, teman-teman!" |
| Empty state mushaf | "belum ada apa-apa di sini… cari surat favmu yuk 🔍" | "Data kosong" |
| Streak jalan | "streak 3 hari — gass terus 🔥" | — |
| Streak putus | "yuk mulai lagi, streak baru dimulai hari ini 🌱" | "Kamu gagal! Streak hilang." |
| Reminder (notifikasi) | "5 menit sore ini? Abu nungguin 😼" / "sekali aja mampir, jan cuma di story 👀" | "Saatnya mengaji!" |
| Kartu hadis Home | "hadis hari ini" — matn Arab + terjemahan + atribusi (rawi · HR. Bukhari/Muslim) | Hadis tanpa sumber; matn yang dipotong biar pendek; **maskot di samping teks hadis** (BRAND § 6.1) |
| Lesson selesai | "+15 XP, mantap! 1 ayat lagi buat Perfect ✨" | — |
|Feedback latihan (benar)| "bener! mantap 🎉" + kalimat Abu di baris meta ("satu soal lewat — kamu makin kenal ayatnya") | Mengulang kalimat yang sama tiap soal — rotasi menurut posisi soal |
|Feedback latihan (salah)| "hmm belum tepat —" + "nggak apa-apa. salah itu bagian dari belajar — Abu juga baru mulai." | "gagal", "harusnya", menyalahkan pemula; maskot menyentuh blok ayat |
| Error network audio | "audionya lagi ngambek, coba lagi ya 🎧" | "Error 500" |
| Hapus data | "yakin hapus semua progres? ini nggak bisa di-undo." (tombol: "Hapus" / "Batal") | — |
| Di sekitar ayat | **"Bismillahirrahmanirrahim"** · **"Surah Al-Fatihah · 7 ayat · Mekkah"** | Emoji/abbrev/slang di metadata & teks ayat |

**Pemisahan kapitalisasi yang disengaja (2026-10-04).** Kolom di atas memakai huruf kecil
di awal kalimat, itu bagian dari Gen-Z voice — jangan "diperbaiki" jadi kapital. Tapi
konten suci punya aturan terpisah: **terjemahan hadis, ayat, dan metadata mushaf selalu
diawali huruf besar**, tanpa emoji dan tanpa slang. Percampurannya pernah terjadi nyata
saat kartu hadis pertama dibuat (terjemahannya mengikuti gaya `tip.*`), lalu diperbaiki;
sekarang dijaga test — `features/home/hadith.test.ts` gagal kalau terjemahan hadis diawali
huruf kecil di locale mana pun.

Konvensi: emoji di meta-UI boleh (maks 1 per string), **tidak pernah** di dalam/menyamping teks ayat; tidak memakai singkatan berlebihan yang mengurangi kejelasan; ejaan santai ("jan", "gas", "yuk") diizinkan pada string non-suci.

## 6. Motion & Feedback

| Momen | Animasi | Durasi/kurva |
|---|---|---|
| Maskot diam (idle) | Ekor berayun dari pangkalnya + badan bernapas halus | 1,7 s & 2,9 s loop; mood `cheer` → 0,9 s & 1,3 s |
| Maskot berkedip | Mata menutup & membuka (hanya saat mata memang terbuka: `idle`/`encourage`) | jeda 2,6 s, tutup 110 ms, buka 150 ms — deterministik, tanpa acak |
| Maskot melambai (`pose="wave"`) | Lengan berayun dari pangkalnya ±7° | 460 ms loop bolak-balik |
| Maskot berjalan masuk (`entrance="walk"`) | Geser dari luar kiri + 2 langkah kecil + pudar, **sekali per sesi app** | 700 ms, ease-out |
| Jawaban benar | Kartu pop scale 1→1.04→1 + warna success + Abu mood `cheer` (mata ^ ^, mulut terbuka) | 180ms spring |
| Jawaban benar (pakai hint) | Sama, tapi Abu mood `happy` — memakai bantuan tetap dihargai | 180ms |
| Jawaban salah | Shake horizontal kecil + warna danger + penjelasan slide-up + Abu mood `encourage` (mata terbuka, senyum kecil) | 220ms |
| Lesson selesai | Konfeti + XP counter roll-up + Abu lompat (mood `cheer` kalau sempurna) | 600–1200ms |
| Streak naik | Api menyala + scale pulse | 300ms |
| Progress ring | Interpolasi halus tiap perubahan | 250ms |
| Navigasi tab | Ikon bounce mikro | 150ms |
| Semua layar | Skeleton shimmer saat load (tidak ada spinner klasik) | — |

Aturan: pakai `react-native-reanimated` (bukan Animated JS) untuk animasi >100ms di jalur interaksi; hormati `prefers-reduced-motion` / setelan aksesibilitas — bila aktif, konfeti & shake diganti fade sederhana.

**Angka gerak maskot hidup di satu tempat**: `CAT_MOTION` di
[src/ui/cat-art.ts](../src/ui/cat-art.ts). Komponen membacanya, dan pratinjau
(`npm run brand:mascot-preview`) membacanya juga — jadi tidak ada salinan durasi
yang bisa basi. Saat reduced-motion aktif, maskot **tidak menjalankan apa pun**:
tidak ada kedip, napas, ayunan, lambaian, dan animasi masuk dilewati begitu saja
(maskot langsung tampil di posisi netral, bukan menghilang lalu muncul). Verifikasi
tidak perlu mengubah setelan OS: `dist/_brand/app-reduced-motion.html` memuat app
dengan `prefers-reduced-motion: reduce` dipaksa aktif sebelum bundle jalan.

## 7. Komponen Inti (`src/ui/components`)

`Button` (primary emerald gradient / secondary glass / ghost) · `Card` (elevated & glass) · `ProgressRing` · `StreakFlame` (jejak kaki + angka) · `XPBadge` · `QuestItem` · `AyahBlock` (Arab + terjemahan + play) · `QuestionCard` (4 varian tipe soal) · `AnswerOption` (state: idle/correct/wrong/disabled) · `ConfettiOverlay` · `Toast` (achievement) · `Skeleton` · `EmptyState` (maskot default, `emoji` untuk kasus spesifik) · `CatMascot` (6 mood, 2 varian bulu, 2 pose, 2 entrance) · `CatPaw` · `SettingRow` · `Sheet` (bottom sheet).

Setiap komponen: variant via prop, tanpa hardcoded warna (semua dari tokens), tanpa import dari `features/` atau `core/`.

**Maskot digambar sebagai SVG** (`CatMascot.tsx`, `react-native-svg` = modul bawaan Expo Go): kurva asli (mata senyum, ekor, kitab) tetap tajam di 40–160 px, tanpa file gambar sama sekali. Versi pertama memakai susunan `View` demi menghindari dependency; hasilnya terbaca seperti hamster, jadi diganti setelah masukan pemilik produk ([BRAND.md](BRAND.md) § 3).

Tiga aturan teknis yang menyertainya:
1. **Art bukan milik komponen.** Seluruh gambar Abu ada di `src/ui/cat-art.ts` sebagai data murni (`catScene()` mengembalikan daftar layer: `tail` · `body` · `eyes` · `wave`). `CatMascot.tsx` hanya renderer + animasi. Alasannya bukan estetika: pratinjau semua pose memakai modul yang sama persis, jadi tidak bisa menyimpang dari yang dilihat user, dan art bisa diuji tanpa stub React.
2. **Animasi di `View`, bukan di prop SVG** — tiap layer jadi satu `<Svg>` di peta koordinat 0–200 yang sama, dibungkus `Animated.View` dengan `transformOrigin` diambil dari layer itu sendiri (pangkal ekor, dasar badan, garis mata, pangkal lengan). Cara ini jalan identik di native dan web, sedangkan animasi prop SVG bergantung implementasi per platform.
3. **Warna maskot hidup di `src/ui/cat-palette.ts` sebagai hex**, karena prop `fill`/`stroke` tidak menerima className Tailwind. `cat-palette.test.ts` memastikan nilainya tetap sama dengan token `cat/*` di `global.css` — duplikasi ini dijaga test, bukan disiplin manual.

**Pratinjau semua pose** (kalau hanya membuka app, ada 24 kombinasi mood × pose × varian yang harus dilewati satu per satu):

```
npm run brand:mascot-preview     # -> dist/_brand/mascot-preview.html
```

Halaman itu menampilkan semua kombinasi, strip ukuran sungguhan yang dipakai app
(56/76/84/104/116 px), tombol ulang animasi masuk, dan sakelar "matikan gerak" yang
meniru `useReducedMotion()`.

## 8. Aksesibilitas & Adab Visual

- Kontras teks minimal **WCAG AA** (4.5:1) — semua pasangan token di atas sudah diverifikasi; teks ayat kontras maksimal.
- Teks ayat TIDAK pernah dipecah per kata untuk styling/animasi (merusak tajwid & ligature); highlight per ayat boleh, per kata tidak.
- Tidak ada animasi di atas teks ayat yang sedang dibaca (hanya dimmer/halaman statis).
- Font Arab bisa diperbesar sampai L tanpa merusak layout (bento & ayah block pakai auto-height).
- Label aksesibilitas (`accessibilityLabel`) di semua ikon tombol; `prefers-reduced-motion` dihormati (§ 6).
- Icon: **Lucide** (stroke konsisten) — jangan campur gaya icon.
