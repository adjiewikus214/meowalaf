# Baseline Performa — hasil ukur nyata

> Budget acuan: [RULES.md](RULES.md) § 9. Semua angka di dokumen ini **diukur**, bukan
> diperkirakan. Diulang dengan `npm run perf:budget` (butuh `dist/` sudah di-build).
>
> Diukur: 4 Okt 2026 (setelah ADR-007 + subset font + ADR-009) · Chrome headless di Windows,
> processor laptop kelas mid · build web dengan `npx expo export --platform web`.
>
> **Update 4 Okt 2026 — setelah rebrand Meowalaf ([BRAND.md](BRAND.md)):** bundle
> **1,99 MB gzip** (9,29 MB mentah, naik 0,01 MB dari 1,98 MB), startup → Home
> **4,05 s Fast 4G** (budget 5,0 s) / 0,91 s lokal, FCP **2,02 s Fast 4G** / 8,60 s Slow 4G
> (budget 10 s), lesson → interaktif **0,91 s Fast 4G**, audio 7 ms, drop frame 0,00 % —
> **semua metrik LULUS**. Maskot kucing & jejak kaki digambar dari `View` + token warna,
> jadi biaya bundle-nya nol; kenaikan 0,01 MB datang dari kartu nasihat harian
> (`features/home/tips.ts`) dan komponen baru, bukan dari aset gambar. Ikon app digambar
> ulang lewat `npm run brand:icons` (bukan aset pihak ketiga).
>
> **Update 4 Okt 2026 — maskot v2 (`react-native-svg`, [BRAND.md](BRAND.md) § 3):** bundle
> **2,00 MB gzip** (9,34 MB mentah) — `react-native-svg` + maskot SVG menambah **0,01 MB**
> dibanding versi sebelumnya, jauh di bawah budget 3,00 MB. Startup → Home **2,18–2,19 s Fast 4G**
> (budget 5,0 s), FCP **1,94 s**, lesson → interaktif **0,5–0,9 s** (dua run; teks Quran baru diunduh
> setelah CTA, jadi angkanya bergantung momen prefetch), audio TTFB 6–23 ms, drop frame
> **0,00 %** (0/241 frame) — semuanya LULUS. Catatan jujur: animasi maskot (ekor berayun &
> napas) diukur ikut di frame layar hasil, dan tetap 0 % drop karena transform `View`
> dijalankan di compositor, bukan di JS thread. Ini tetap pengukuran laptop headless tanpa
> GPU — klaim "aman di device kelas bawah" belum bisa dibuat dari sini.
>
> **Update 4 Okt 2026 — pose & animasi maskot ([BRAND.md](BRAND.md) § 8):** bundle **2,01 MB
> gzip** (9,47 MB mentah, +0,01 MB dari 2,00 MB). Art maskot pindah ke modul data murni
> `src/ui/cat-art.ts`, jadi gerakan baru (kedip, lambaian, animasi masuk) tetap **nol byte
> aset gambar** — yang naik cuma kode. Startup → Home **3,66 s Fast 4G** (budget 5,0 s),
> FCP **7,87 s Slow 4G** (budget 10 s) / 1,90 s Fast 4G, lesson → interaktif **0,68 s Fast 4G**
> (budget 2,0 s), audio TTFB 4 ms, drop frame **0,00 %** (0/241) — semua LULUS.
>
> **Catatan jujur soal cara mengukur**: satu run lebih awal **GAGAL** di metrik lesson
> (**2,32 s**) dengan startup 3,22 s, karena saat itu **empat tab browser** masih
> terbuka di mesin yang sama. Setelah tab ditutup, angkanya kembali ke 0,68 s / 3,66 s. Jadi
> metrik lesson (dan startup) **sensitif beban mesin** — jangan pernah dibaca dari satu run
> saja, dan jangan pernah disimpulkan jadi regresi kode tanpa mengulang run dengan tab lain
> ditutup. Bundle & drop frame tetap stabil di kedua run.
>
> **Perbaikan lain yang ikut terukur**: ticker splash di `core/progress/hydration.tsx` dulu
> `setInterval(100 ms)` yang **tidak pernah berhenti** hanya untuk memperbarui angka yang
> setelah grace sudah tidak ada yang baca — root layout pun re-render **10×/detik selamanya**.
> Sekarang berhenti tepat di `SPLASH_GRACE_MS`. Dampaknya bukan pada byte, tapi pada
> kestabilan animasi sekali-jalan: di tab yang timer-nya di-throttle, subtree rute ikut
> di-render ulang dan animasi "berjalan masuk" maskot terulang terus. Setelah perbaikan,
> probe DOM bertahan > 1,5 s tanpa remount dan rAF normal (31 fps).

## Cara mengukurnya

`scripts/perf-budget.mjs` (tanpa dependency) melakukan empat hal:

1. **Ukuran bundle** dihitung dari file nyata di `dist/`, gzip level 9 per berkas.
2. **Link throttled** dibuat sungguhan oleh server statis di dalam skrip: latensi
   setengah RTT sebelum byte pertama, lalu **satu pipa bandwidth bersama** yang dibagi
   round-robin ke semua koneksi yang sedang berjalan.
3. **Chrome headless** membuka app dengan profil kosong (cache, localStorage, dan
   OPFS kosong), lalu skrip injeksi menjalankan alur nyata: lewati onboarding →
   catat waktu Home muncul → buka lesson → putar audio ayat → selesaikan lesson →
   ukur frame animasi layar hasil.
4. Server mencetak tabel lulus/gagal per metrik + byte yang benar-benar turun di kabel.

### Dua koreksi pada alat ukur (penting untuk membaca angka)

Run pertama (3 Okt 2026, sebelum ADR-007) punya dua cacat yang membuat angkanya **tidak
fair**:

- **Server tidak mengompres.** `serve dist` dan `expo export` mengirim berkas mentah;
  Vercel/Netlify/CDN mengirim gzip/brotli. Entry chunk 8,5 MB mentah di throttle
  200 KB/s = 42 detik **hanya transfer**. Angka "52 detik" itu sebagian besar artefak
  alat ukur, bukan yang dialami user.
- **Throttle per koneksi, bukan bersama.** Enam koneksi paralel browser masing-masing
  dapat 200 KB/s penuh -> link sungguhan jadi 6× lebih cepat dari yang dideklarasikan.

Sekarang server skrip ini gzip seperti CDN dan berbagi satu pipa. Semua angka di bawah
diukur dengan versi yang sudah diperbaiki.

## Angka (4 Okt 2026, setelah ADR-007 + subset font + ADR-009)

| Metrik | Slow 4G | Fast 4G | localhost | Budget (RULES § 9) | Hasil |
|---|---|---|---|---|---|
| First contentful paint (tampilan pertama) | 7.520-8.228 ms | 1.812-1.856 ms | 544 ms | < 10.000 ms (Slow 4G) | **LULUS** |
| Startup -> Home interaktif (cache kosong) | 9.042-11.212 ms | 2.046-3.615 ms | 798 ms | < 5.000 ms (Fast 4G) | **LULUS** |
| CTA "Lanjut Ngaji" aktif (menunggu storage) | 10.546-11.280 ms | 4.874-4.905 ms | 2.128 ms | (tidak ada budget) | - |
| Placeholder tampil tanpa angka 0 (ADR-009) | ya | ya | ya | placeholder ya, angka 0 tidak | **LULUS** |
| Buka layar lesson -> interaktif | 10.052-10.141 ms | 503-579 ms | 389 ms | < 2.000 ms (Fast 4G) | **LULUS**\* |
| Play audio ayat -> byte pertama | 4-7 ms | 7 ms | 4-10 ms | < 500 ms | LULUS |
| Bundle web (gzip) | — | — | — | < 3 MB | **LULUS** (1,98 MB) |
| Drop frame saat animasi layar hasil | 0,00 % | 0,00 % | 0,00 % | < 5 % | LULUS\*\* |

Budget di kolom terakhir berlaku **hanya di profilnya** (Slow 4G tidak lagi punya
budget waktu untuk startup — lihat [ADR-008](adr/ADR-008-budget-startup-fast-4g-bukan-slow-4g.md)
dan bagian "Kenapa Slow 4G 2 detik tidak mungkin"). Rentang di atas adalah 3-4 sample
per profil, satu per satu.

First contentful paint diambil dari `PerformancePaintTiming` yang dibaca skrip yang
disuntikkan (`out.paint.fcpMs`) — jadi angkanya benar-benar "sudah ada frame di layar",
termasuk kasus kita di mana splash kosong.

Angka startup diambil satu per satu (`--link=slow4g`, lalu `--link=fast4g`, lalu
`--link=none`), **bukan** dari satu run berurutan. Alasannya jujur: run berurutan
mematikan Slow 4G, Fast 4G, lalu localhost di proses yang sama, dan profil terakhir
naik 0,4-1,2 detik karena mesinnya masih sibuk. Angka localhost dari run berurutan
(2.611 ms) lebih buruk daripada standalone (1.192-1.347 ms, LULUS) padahal tidak ada
throttle sama sekali — itu ukuran kontaminasi alat ukur, bukan sifat app. Kalau
membandingkan dua versi, pakai mode yang sama persis.

Profil link: **Slow 4G** = 150 ms RTT + 1,6 Mbps · **Fast 4G** = 9 ms RTT + 9,2 Mbps ·
**localhost** = tanpa throttling. Total yang benar-benar dikirim server: **2,47 MB gzip
/ 9,37 MB mentah** (seluruh alur, bukan hanya startup). Saat Home tampil, transfer yang
sudah masuk **0,87 MB** (sebelum subset font: 1,56 MB).

\* Regresi yang **sengaja dipertukarkan**: teks Quran (0,67 MB gzip) dimuat sebagai chunk
terpisah, jadi skrip yang menekan "Lanjut Ngaji" secepatnya ikut menunggu chunk. User
sungguhan punya waktu untuk membaca Home dulu; prefetch `requestIdleCallback` sudah
berjalan sejak Home tampil.

\*\* Diukur dalam kondisi paling(memihakkan: laptop headless tanpa GPU. Belum terbukti
pada device kelas bawah; lihat ROADMAP § 4.

## Subset font (3 Okt 2026)

Lima font yang dibundel bernilai 0,44 MB gzip dan **semuanya ada di jalur startup**,
karena `useFonts` di root layout menahan splash sampai semuanya siap. Dua temuan
ketika memetakan pemakaiannya:

1. **`font-arab` tidak pernah jadi kelas.** 12 call site memakai `font-arab`
   (`MateriPanel`, `QuestionCard`, `AyahBlock`, mushaf, detail surat, kartu Home), tapi
   `global.css` tidak pernah mendeklarasikan `--font-arab`, jadi Tailwind tidak
   menghasilkan `.font-arab` sama sekali. Akibatnya Amiri (0,21 MB gzip) **diunduh
   tapi tidak pernah dipakai** — teks Arab dirender font Arab bawaan browser, yang beda
   di tiap perangkat. Token-nya sekarang ada; mushaf, materi lesson, dan nama surat
   benar-benar dirender Amiri.
2. **Plus Jakarta Sans SemiBold + Bold tidak pernah dirender.** Tidak ada satu pun
   `font-weight`/`font-bold`/`font-semibold` di seluruh app, dan `--font-sans` hanya
   menunjuk Regular. Dua weight itu 0,11 MB gzip yang ditahan splash tanpa alasan.

Setelah dibetulkan, empat font yang benar-benar dipakai di-subset ke glyph yang
memang muncul di repo:

| Font | Peran | Glyph diminta / dipertahankan | mentah | gzip |
|---|---|---|---|---|
| `Amiri-Regular` | mushaf (`font-arab`) + matn hadis | 382 / 322 | 442,8 KB -> 141,3 KB | 211,0 KB -> **77,4 KB** |
| `Poppins-Regular` | body (`--font-sans`) | 1.892 / 355 | 156,6 KB -> 25,7 KB | 70,5 KB -> **15,5 KB** |
| `Poppins-Bold` | judul (`--font-display`) | 1.892 / 355 | 152,3 KB -> 25,3 KB | 69,6 KB -> **15,2 KB** |
| `NotoSans-Regular` | transliterasi (`--font-translit`) | 12 / 12 | 555,9 KB -> 3,4 KB | 279,3 KB -> **2,1 KB** |
| **Total** | | | 1,28 MB -> 0,19 MB | 0,62 MB -> **0,11 MB (-82 %)** |

Cara kerjanya (semua di repo, tanpa layanan luar):

- `scripts/fonts/glyphs.mjs` menghitung inventaris dari isi repo — semua karakter
  non-Arab di `app/` + `src/` (kode **dan** data konten) untuk font Latin, semua
  karakter Arab untuk Amiri. 103 file dipindai. Rentang dasar Latin (Latin-1, Latin
  Extended-A/Additional untuk nama beraksen, tanda baca tipografis, panah, simbol)
  selalu ikut, karena nama yang diketik user tidak bisa dipredict.
- `npm run fonts:subset` (`scripts/fonts/subset-fonts.mjs`, `subset-font`/harfbuzz)
  menulis hasilnya ke `src/ui/assets/fonts/` dengan **nama file yang sama**, jadi
  `FONT_MAP` di `app/_layout.tsx` tidak berubah dan tidak ada risiko FOUT. Font asli
  disimpan di `src/ui/assets/fonts/_source/` supaya bisa dibangun ulang offline.
- Verifikasi berlapis: skrip tidak menulis hasil bila ada glyph yang hilang dibanding
  font asli, dan `scripts/fonts/subset-fonts.test.ts` (5 test) mengunci kontraknya —
  termasuk daftar 37 karakter yang memang jatuh ke font sistem (25 emoji, 9 simbol,
  U+FE0F, U+08D6), supaya teks baru yang diam-diam butuh font sistem tidak lolos
  tanpa terlihat. Kalau `content:build` mengubah isi data, test gagal sampai subset
  dibangun ulang.
- Font ikon **tidak** ikut di-subset: itu glyph map, bukan teks.

Dua keputusan yang perlu dicatat:

- **Tidak pakai "blok Arab penuh".** Menahan Amiri di seluruh blok Unicode Arab
  (U+0600-06FF + 0750-077F + 08A0-08FF) diukur 166 KB gzip untuk teks Arab yang tidak
  pernah muncul — 90 KB ekstra. Default memakai korpus repo; kalau nanti teksnya
  berasal dari sumber dengan ortografi lain:
  `npm run fonts:subset -- --with-arabic-blocks`.
- **U+08D6 (small high meem, notasi iqlab) tidak ada di Amiri** — sudah begitu juga
  sebelum subset, di 562 ayat. Browser mengambil satu harakat itu dari font Arab
  sistem; hasil QA di Al-Fatihah 1:7 tidak menunjukkan kotak kosong maupun lompatan
  visual. Menormalisasinya ke U+06E2 berarti mengubah data Quran, jadi itu keputusan
  konten (RULES § 7), bukan chores subset.

Hasil terukur setelah subset font: bundle web **2,27 -> 1,98 MB gzip**, byte yang masuk
saat Home tampil **1,56 -> 0,92 MB**, startup Slow 4G **18,3 -> 10,0 s**. Di localhost
startup kini **lolos** budget (1,19-1,35 s).

## Body font tidak pernah terpakai (4 Okt 2026)

Baru ketika body font diganti ke Poppins, suatu bug lama ikut ketahuan — dan bug itu
melebihi ukuran berkasnya.

`body { font-family: var(--font-sans) }` dari preflight **tidak pernah dipakai app**.
react-native-web memberi setiap `<Text>` rule atomic sendiri
(`font: 14px -apple-system, BlinkMacSystemFont, …` pada class `css-*`), dan rule itu
menang. Jadi sejak Plus Jakarta Sans dipasang, **seluruh teks app dirender font
sistem**; hanya elemen non-`<Text>` yang benar-benar memakai `--font-sans`. Ini yang
membuat kejadian sebelumnya (`font-arab` tidak pernah jadi kelas) tetap tersembunyi:
`.font-display`/`.font-arab`/`.font-translit` **berhasil** — utility-nya override rule
itu — jadi Computed Style pada elemen yang spesifik terlihat benar, dan pemeriksaan
mata pada satu-dua layar tidak pernah menemukan selectors yang gagal.

Perbaikannya: override per token dengan specificity lebih tinggi **dan** `!important`,
`[dir] { font-family: var(--font-sans) !important }` plus satu blok per token
(`.font-display`, `.font-arab`, `.font-translit`). Konsekuensi yang disengaja:
override diwarisi ke `font-family` milik anak, sehingga "pakai font lain" tetap cukup
menulis kelasnya, bukan bergantung urutan stylesheet.

Biaya perpindahan font sendiri ternyata **negatif**: Plus Jakarta Sans (34,3 KB gzip)
dan Space Grotesk (32,5 KB gzip) diganti Poppins Regular + Bold (15,5 + 15,2 KB).
Sisa yang ditambahkan adalah `NotoSans-Regular` **2,1 KB gzip** untuk fallback
transliterasi — kecil karena hanya 12 glyph yang memang dipakai teks, bukan karena
font aslinya kecil (asli 555,9 KB mentah / 279,3 KB gzip, disubset jadi 3,4 KB mentah).
Total font app turun **0,15 -> 0,11 MB gzip**. `NotoSans` dipilih karena menutup
12/12 glyph; Plus Jakarta Sans hanya 8/12 dan Space Grotesk 10/12, jadi keduanya tidak
cukup sebagai fallback (lihat
[transliteration-font.test.ts](../scripts/fonts/transliteration-font.test.ts)).

## SQLite keluar dari jalur paint (ADR-009, 4 Okt 2026)

Splash lama ditahan sampai SQLite selesai dibuka. Murah di kertas, mahal di kabel:
`wa-sqlite.wasm` 0,29 MB + `worker-*.js` mulai diunduh **bersamaan** dengan entry,
`__common`, dan tiga font — semuanya berbagi satu pipa. Sekarang di web splash
melepas begitu font siap, dan **pembukaan DB justru dimulai setelah Home tampil**.
Konsekuensinya, bukan pemotongan byte: ukuran bundle tidak berubah sama sekali.

| Metrik | Sebelum | Sesudah |
|---|---|---|
| Startup -> Home, Fast 4G | 4,02-4,19 s | **2,05-3,62 s** |
| FCP, Slow 4G | 8,61-8,77 s | **7,52-8,23 s** |
| Startup -> Home, Slow 4G | 10,01-10,54 s | **9,04-11,21 s** |
| Permintaan `wa-sqlite.wasm` di kabel | sebelum paint | **+3,5 s** setelah dokumen (Fast 4G), **+13,0 s** (Slow 4G) |
| Placeholder terlihat tanpa angka 0 | n/a | **ya, di semua run** |

Harga yang dibayar: angka streak/XP tampil **2-3 detik setelah Home**, saat DB
selesai dibuka. Itu konsekuensi yang sengaja diambil — lebih baik satu lompatan yang
jelas daripada Home yang tidak pernah tampil di link lambat. Detail keputusannya di
[ADR-009](adr/ADR-009-home-tampil-sebelum-sqlite-selesai.md).

Dua cacat alat ukur yang ketahuan di sini (tanpa keduanya, klaim di atas tidak bisa
dibuktikan):

1. **Resource Timing di halaman tidak melihat permintaan Web Worker** — dan
   itulah worker yang mengambil wasm SQLite. Bukti "wasm keluar dari jalur paint" diambil
   dari **log arrival sisi server** (`state.arrivals`): di Fast 4G permintaannya
   tiba 3,5 s setelah dokumen, jauh setelah FCP 1,8 s.
2. **Placeholder check lama memakai pencocokan longgar** dan ikut menyangkut `0/1`
   milik quest (AsyncStorage, nilainya benar sejak awal) — harness melaporkan
   pelanggaran yang tidak ada. Sekarang definisi flash adalah **urutan yang salah**:
   angka nyata muncul sebelum placeholder, atau keduanya hidup bersamaan.

## Perbandingan dengan run sebelumnya (alat ukur berbeda)

| | bundle gzip | entry sebelum Home | startup Slow 4G | startup Fast 4G | startup localhost |
|---|---|---|---|---|---|
|Sebelum (harness lama) | 4,14 MB | 8,5 MB / 1,39 MB gzip | 52,0 s | 9,7 s | 9,3 s |
| Sesudah (ADR-007) | 2,27 MB | 1,08 MB / 0,28 MB gzip | 18,3 s | 6,6 s | 2,0 s |
| Sesudah (subset font) | 1,98 MB | 1,08 MB / 0,28 MB gzip | 10,0 s | 4,2 s | 1,2 s |
| Sesudah (ADR-009) | 1,98 MB | 1,08 MB / 0,28 MB gzip | 9,0-11,2 s | 2,0-3,6 s | 0,8 s |

Angka "sesudah" memakai harness yang diperbaiki (gzip + pipa bersama), jadi lebih
kecil daripada yang akan didapat user sebenarnya di Vercel (HTTP/2, banyak koneksi).

## Isi bundle sekarang

| Berkas | gzip | Dimuat sebelum Home? |
|---|---|---|
| `__common-*.js` | 0,29 MB | ya |
| `entry-*.js` | 0,28 MB | ya |
| `wa-sqlite.wasm` | 0,29 MB | **tidak** — diminta setelah Home tampil |
| 4 font app hasil subset (Amiri, Poppins ×2, Noto Sans) | 0,11 MB | ya |
| `Ionicons.ttf` | 0,20 MB | ya (tab bar) |
| **`loader-*.js` (teks Quran)** | **0,67 MB** | **tidak — prefetch saat idle** |
| route chunk per layar | 0,01–0,03 MB | saat dibuka |
| `worker-*.js` (wa-sqlite web worker) | 0,04 MB | **tidak** — setelah Home tampil |

Font ikon: **1** family (sebelumnya 19 file .ttf, ~1,48 MB gzip terbuang). Sekarang
`Ionicons.ttf` (0,20 MB) justru lebih besar daripada ketiga font teks yang digabung —
lever berikutnya yang paling jelas, karena glyph ikon yang dipakai repo bisa dihitung
dengan pipeline yang sama.

## Kenapa Slow 4G 2 detik tidak mungkin (dan kenapa first paint tidak menolong)

Dengan gzip, byte yang harus turun sebelum Home tampil ≈ **0,87 MB**. Pada Slow 4G
(200 KB/s) itu saja **4,4 detik** — tanpa satu pun parse atau render. Target 2,0 s
di profil itu menuntut **≤ 400 KB** sebelum Home, jadi lebih dari separuh byte harus
hilang dari jalur startup. Stack web sekarang (React Native Web + 3 font + glyph map
ikon) tidak punya jalur itu.

Dan memindahkan target ke "tampilan pertama" ternyata tidak menolong: FCP di Slow 4G
terukur **7,5-8,2 s** — turun 1,1 s setelah ADR-009, tapi tetap jauh di atas 2,0 s.
Di Fast 4G selisih FCP -> Home cuma ~0,2-1,8 s, jadi first paint bukan "paint awal"
yang murah, cuma frame pertama yang kebetulan punya isi.

Akibatnya budget dipindah, dan keputusannya tercatat di
[ADR-008](adr/ADR-008-budget-startup-fast-4g-bukan-slow-4g.md):

| Yang di-budget | Di profil mana | Angka |
|---|---|---|
| Startup -> Home interaktif | Fast 4G | < 5,0 s (terukur 2,05-3,62 s) |
| First contentful paint | Slow 4G | < 10,0 s (terukur 7,52-8,23 s) |
| Lesson -> interaktif | Fast 4G | < 2,0 s (terukur 0,50-0,58 s) |
| Bundle web (gzip) | - | < 3 MB (terukur 1,98 MB) |

Byte jadi penjaga utama, karena tidak ada lagi budget waktu di link lambat. Opsi yang
masih tersisa untuk benar-benar mengejar 2,0 s di Slow 4G adalah perubahan shell web
(static rendering Home, atau app shell tanpa SQLite di web) — bukan optimasi, dan
keduanya di luar v1 karena bertabrakan dengan offline-first ADR-004.

## Sisa pekerjaan yang terukur (urut berdasarkan dampak)

1. **Subset `Ionicons.ttf`** — 0,20 MB gzip, sekarang asset tunggal terbesar di jalur
   startup, dan lebih besar daripada ketiga font teks yang digabung. Glyph ikon
   yang dipakai repo bisa dihitung dengan pipeline yang sama (`scripts/fonts/`); beda
   dari font teks, subset yang bolong di sini langsung berarti ikon hilang.
2. ~~**SQLite keluar dari splash**~~ — **selesai** di ADR-009 (4 Okt 2026). 0,29 MB
   wasm + 0,04 MB worker tidak lagi turun sebelum Home tampil; Startup Fast 4G
   4,2 -> 2,0-3,6 s. Batasannya sekarang: angka progres melonjak 2-3 s setelah Home
   tampil, karena itu angka `0` tidak boleh muncul lebih dulu.
3. **`__common` 0,29 MB** — masih memuat zod + shared UI. Zod hanya dipakai saat
   validasi bundle konten; memindahkannya ke worker/mulai-mula bisa memangkas sebagian.
4. **HTTP/2 di produksi** — harness memakai HTTP/1.1 (6 koneksi), produksi Vercel
   HTTP/2; angka produksi akan lebih baik dari angka di tabel.

## Catatan kejujuran soal angkanya

- **Angka harness lebih buruk dari produksi**: HTTP/1.1 + gzip level 9 (bukan brotli).
  Arahnya jelas (konservatif), tapi tetap perkiraan, bukan angka Vercel.
- **Drop frame 0,00 % bukan bukti lolos untuk device kelas bawah** — diukur di laptop
  headless tanpa GPU, tanpa input user. Budget § 9 menyebut "device kelas bawah";
  angka itu hanya terbukti di device asli (ROADMAP § 4 masih menunggu device).
- **Budget yang baru dipilih setelah angkanya ada** (ADR-008), bukan sebelum: mengubah
  target agar "lolos" adalah cara tercepat membuat budget tidak berguna, jadi versi
  lamanya dicatat lengkap beserta aritmetikanya, bukan dihapus.
- **Audio terukur dari cache** (file ayat sudah ter-prefetch saat layar materi dibuka).
- Headless tidak bisa memutar suara; yang diukur adalah saat byte pertama tersedia.
- **Variansi nyata dan run yang tercemar.** Fast 4G diulang 3× memberi startup
  2,05-3,62 s; satu run sempat 8,1 s karena 16 proses Chrome sisa masih jalan di
  mesin. Prozessor yang dipakai user tidak sepi seperti laptop uji. Karena itu
  budget diambil dari rentang beberapa sample, bukan satu angka bagus.
- Untuk membandingkan dua versi, jalankan di mesin yang sama, satu per satu.