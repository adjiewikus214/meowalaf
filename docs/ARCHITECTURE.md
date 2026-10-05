# Architecture — Meowalaf

> **Status**: v1.1 · **Tanggal**: 2026-10-04 · Companion: [PRD.md](PRD.md), [RULES.md](RULES.md), [DESIGN.md](DESIGN.md), [BRAND.md](BRAND.md), [ROADMAP.md](ROADMAP.md)
>
> Nama folder di pohon § 3 masih `ayatin/` sebagai nama direktori kerja; nama produk, user-facing, sudah **Meowalaf** ([BRAND.md](BRAND.md) § 4).

## 1. Prinsip

1. **Engine terpisah dari UI.** Semua logika (grading jawaban, XP, streak, quest) adalah *pure functions* di `src/core` dan `src/features/*` — tidak ada import React, tidak bisa menyentuh UI. UI memanggil engine, bukan sebaliknya.
2. **Data terpisah dari presentasi.** Screen tidak pernah membaca/ menulis storage langsung; screen memanggil hooks dari `src/features/*/hooks.ts`, hooks memanggil engine + repo.
3. **Satu owner per state.** Progres user dimiliki `src/core/progress` (satu store). UI state (membuka tab, form) dimiliki screen masing-masing. Audio dimiliki satu controller global.
4. **Data flow satu arah**: `UI → hooks → engine (pure) → repo (storage)` dan hasil mengalir balik lewat store sebagai state. Tidak ada screen yang memanggil screen lain untuk mengubah data.
5. **Cross-platform by default, platform-specific by exception.** Logic selalu lintas platform; kode khusus platform hanya boleh muncul sebagai file `.native.ts(x)` / `.web.ts(x)` atau `Platform.select`, dan fitur mobile-only (notifikasi, haptic) WAJIB punya no-op di web.

## 2. Tech Stack (final)

| Lapisan | Pilihan | Catatan |
|---|---|---|
| Framework | Expo SDK stable terbaru + expo-router | 1 codebase → web / iOS / Android |
| Bahasa | TypeScript (strict, `noUncheckedIndexedAccess`) | [RULES.md](RULES.md) § 3 |
| Styling | NativeWind v4 (Tailwind) | Token design via CSS variables + tailwind config |
| State | Zustand (+ `zustand/middleware/persist` untuk profil & settings) | Store kecil per domain, satu owner |
| DB lokal | `expo-sqlite` | Progres, log, SRS — migrations disimpan di `src/data/db` |
| Konten teks | JSON bundle statis (`src/data/content`) | Arab Uthmani + terjemahan + metadata surah |
| Audio | Streaming HTTPS per ayat + controller global; library mengikuti hasil spike Phase 1 (expo-av/expo-audio) | API abstraction di `src/features/mushaf/audio` |
| Notifikasi | `expo-notifications` (mobile only, guard web) | Reminder harian |
| Animasi | `react-native-reanimated` v3 | Lihat [DESIGN.md](DESIGN.md) § 6 |
| Grafik vektor | `react-native-svg` (modul bawaan Expo Go) | Maskot & ornamen kucing (BRAND.md § 3); animasi tetap di `Animated.View`, bukan prop SVG |
| Test | Vitest (engine, pure), React Native Testing Library (komponen kunci) | CI: GitHub Actions |

**Kenapa bukan X**: Flutter (bahasa baru, web dari Flutter kurang nyaman untuk konten teks+scroll panjang), Next.js + Capacitor (dua dunia rendering, dobel effort styling native), Kotlin+Swift native (3× effort untuk MVP).

## 3. Struktur Folder (sumber kebenaran — mulai Phase 1)

```
meowalaf/  (folder kerja: ayatin/)
├── app/                          # expo-router: HANYA routing & layout (presentasi tipis)
│   ├── _layout.tsx               # root layout: providers (db, audio, dsb.)
│   ├── (tabs)/
│   │   ├── _layout.tsx           # bottom tabs: Home · Mushaf · Profil
│   │   ├── index.tsx             # Home
│   │   ├── mushaf.tsx            # daftar surat
│   │   └── profile.tsx           # profil + settings
│   ├── lesson/[surahId]/[unitIndex].tsx
│   ├── surah/[surahId].tsx       # detail surat (mushaf)
│   ├── about.tsx                 # "Tentang & Sumber Konten" (RULES § 7.6)
│   ├── bookmarks.tsx             # daftar "Ayat Favorit"
│   ├── onboarding.tsx
│   └── +not-found.tsx
│
├── src/
│   ├── features/                 # logika per domain fitur (boleh depend core/)
│   │   ├── home/
│   │   │   └── hadith.ts          # data hadis shahih + rotasi per hari WIB (PURE, atribusi wajib)
│   │   ├── lessons/
│   │   │   ├── engine.ts         # grading, urutan soal, retry queue (PURE)
│   │   │   ├── generator.ts      # bangun soal dari konten surat (PURE)
│   │   │   ├── types.ts
│   │   │   └── hooks.ts          # useLesson(surahId), submitAnswer(), dst.
│   │   ├── gamification/
│   │   │   ├── xp.ts             # aturan XP & level curve (PURE)
│   │   │   ├── streak.ts         # streak + freeze logic (PURE)
│   │   │   ├── quests.ts         # generator quest deterministic (PURE)
│   │   │   ├── achievements.ts   # definisi & evaluasi unlock (PURE)
│   │   │   └── hooks.ts
│   │   └── mushaf/
│   │       ├── model.ts          # Surah/Ayah types + lookup (PURE)
│   │       ├── audio/
│   │       │   ├── controller.ts # AudioController singleton (state machine)
│   │       │   ├── web.ts        # implementasi HTMLAudioElement
│   │       │   ├── native.ts     # implementasi expo-av/expo-audio
│   │       │   └── types.ts
│   │       └── hooks.ts
│   │
│   ├── core/
│   │   ├── i18n/                 # kamus id/en + hook (satu sumber copy UI)
│   │   │   ├── id.ts             # sumber kebenaran kunci (TranslationKey)
│   │   │   ├── en.ts             # bertipe Dictionary → tsc menolak kunci yang lupa
│   │   │   ├── index.ts          # translate(), formatDay(), localeTag(), LOCALES
│   │   │   └── hooks.ts          # useT() / useLocale()
│   │   ├── progress/             # SATU owner state progres user
│   │   │   ├── store.ts          # zustand store profil/settings + actions
│   │   │   ├── lesson-store.ts   # zustand store progres lesson/gamifikasi (satu owner)
│   │   │   ├── bookmark-store.ts # zustand store bookmark favorit ayat (tabel ayah_bookmark)
│   │   │   ├── hydration-store.ts# fase boot: bolehkah angka progres tampil (ADR-009)
│   │   │   ├── hydration.tsx     # useSplashReveal + usePersistentHydration (ADR-009)
│   │   │   ├── repo.ts           # interface + sqlite implementation
│   │   │   └── types.ts
│   │   ├── srs/                  # v2: spaced repetition (SM-2 lite) — kerangka saja di v1
│   │   │   └── scheduler.ts
│   │   ├── content/              # loader & validasi konten bundle
│   │   │   ├── meta.ts           # metadata kecil (114 surah, qari, manifest) - selalu di bundle awal
│   │   │   ├── loader.ts         # teks Quran 2,6 MB - HANYA lewat dynamic import (ADR-007)
│   │   │   ├── text-module.ts    # gerbang pemuat chunk teks (isQuranTextReady)
│   │   │   ├── ayah-source.ts    # registry sumber ayat untuk modul pure
│   │   │   └── schema.ts         # zod schema konten
│   │   └── db/
│   │       ├── index.ts          # open db, run migrations
│   │       ├── migrations.ts
│   │       └── (repos per tabel di core/progress & features)
│   │
│   ├── data/
│   │   └── content/              # OUTPUT pipeline (JANGAN edit manual):
│   │       ├── surah-metadata.json
│   │       ├── quran-uthmani.json        # {surahId: {ayahNo: text}}
│   │       ├── translation-id.json       # terjemahan Indonesia
│   │       ├── audio-reciters.json       # daftar qari + URL template
│   │       └── manifest.json             # versi bundle + checksum
│   │
│   └── ui/                       # design system (hanya komponen & token)
│       ├── tokens.ts             # token non-warna (spacing, radius, tipografi)
│       ├── cat-palette.ts        # warna maskot untuk SVG (dijaga test = token global.css)
│       ├── cat-art.ts            # art maskot sebagai DATA murni (layer, pose, CAT_MOTION)
│       ├── transliteration.ts    # kata ber-transliterasi Arab -> font fallback (murni)
│       ├── components/           # Button, Card, ProgressRing, StreakFlame, CatMascot, dst.
│       │   ├── CatMascot.tsx     # renderer catScene() + animasi (napas/ekor/kedip/lambai/entrance)
│       │   ├── TransliteratedText.tsx  # bungkus tiap kata dengan --font-translit
│       │   └── HadithCard.tsx        # kartu kutipan hadis (TANPA maskot, BRAND § 6.1)
│       ├── patterns/             # kombinasi komponen (BentoCard, SectionHeader)
│       └── assets/
│           ├── fonts.ts          # 4 font yang dirender (dipetakan FONT_MAP)
│           └── fonts/            # hasil subset + _source/ (font asli, tak dibundel)
│
├── scripts/
│   ├── build-content/            # pipeline konten (Node/TS, dijalankan manual/CI)
│   ├── brand/                    # ikon app (PNG sendiri) + pratinjau semua pose maskot
│   │   ├── png.mjs               # encoder/decoder PNG (zlib saja, tanpa dependency)
│   │   ├── render-icons.mjs      # gambar ulang assets/*.png secara deterministik
│   │   ├── render-icons.test.ts  # guard: dimensi, palet, dan anti-drift berkas
│   │   ├── mascot-preview.ts     # pratinjau semua pose maskot
│   │   └── mascot-preview.test.ts
│   ├── fonts/                    # pipeline subset font (npm run fonts:subset)
│   │   ├── glyphs.mjs            # inventaris glyph dari isi repo (sumber kebenaran)
│   │   ├── cmap.mjs              # pembaca cmap TTF untuk verifikasi
│   │   ├── subset-fonts.mjs      # build + cek hasil
│   │   ├── subset-fonts.test.ts  # regression guard
│   │   └── transliteration-font.test.ts  # Poppins <-> Noto Sans, kunci 12 glyph
│   └── perf-budget.mjs           # alat ukur startup vs RULES § 9
│
├── docs/                         # dokumen perencanaan (folder ini)
├── app.json / tailwind.config.js / tsconfig.json / package.json
└── .github/workflows/ci.yml
```

Aturan dependensi arah (dicek lewat lint `import/no-restricted-paths` saat diimplementasikan):

```
app/  →  src/features  →  src/core  →  src/data
  ↘           ↘             ↘
   src/ui   (UI boleh dipakai semua; ui tidak boleh import features/core)
```

## 4. Desain Modul Kunci

### 4.1 Lesson Engine (`src/features/lessons/engine.ts`) — PURE
```ts
// Kontrak inti (nama final mengikuti implementasi):
type LessonSession = {
  surahId: number; unitIndex: number;
  questions: Question[];          // urutan main
  retryQueue: Question[];         // soal salah, maks 1 pengulangan
  stats: { correct: number; wrong: number; hintsUsed: number };
};
// gradeAnswer(session, questionId, answer) → { verdict, session', feedback }
// finishSession(session) → { xpEarned, accuracy, achievementsUnlocked }
```
- Generator soal (T1–T4) deterministic: seed = `surahId * 100 + unitIndex + tanggal` → opsi & urutan soal konsisten untuk sesi yang sama, beda antar hari.
- Semua soal punya `explain` (terjemahan benar) untuk feedback inline.
- XP dihitung engine gamification, bukan engine lesson — lesson mengirim *events* (`AnswerCorrect`, `SessionCompleted`, dst.).

### 4.2 Gamification Engine (`src/features/gamification/*`) — PURE
- `xp.ts`: event → delta XP; kurva level `XP_level(n) = 50·n·(n+1)/2` (keputusan open #3 di PRD § 10).
- `streak.ts`: fungsi `computeStreak(today, lastActiveDate, streak, freezeAvailable)` — semua input tanggal sebagai "hari WIB" (YYYY-MM-DD, via helper `toWibDate`). **Unit test wajib**: dobel di hari sama, lintas midnight, lintas timezone device, pemakaian freeze.
- `quests.ts`: `questsFor(dateSeed, profile)` — deterministic, sama untuk semua user di tanggal sama (v1, tanpa backend; berbeda antar user hanya lewat seed lokal jika diinginkan nanti).
- `achievements.ts`: evaluasi dari *log*, bukan flag tersebar.

### 4.3 Progres (`src/core/progress`)
- Zustand store = **sumber kebenaran runtime**; SQLite = **sumber kebenaran persisten**. Satu-satunya yang menulis SQLite adalah repo di modul ini. Store di-hydrate dari SQLite saat app start (async, dengan splash guard).
- Semua mutasi progres melewati actions store; actions memanggil repo; komponen hanya subscribe.
- **Fase boot dimiliki store, bukan UI** (`hydration-store.ts`, ADR-009). Fungsi murni `isProgressLoading(phase, progressStatus)` adalah satu-satunya penentu "apakah angka progres boleh tampil"; layar tidak pernah memutuskan sendiri. Di web splash **tidak** menunggu SQLite (unduhan wasm-nya justru dimulai setelah Home tampil, supaya tidak berebut pipa dengan entry/font), jadi angka yang belum termuat ditampilkan sebagai **placeholder dengan slot berukuran sama** — `0` adalah klaim, bukan "belum tahu". Native tetap menunggu hydration karena tidak ada unduhan saat startup.

### 4.4 Audio (`src/features/mushaf/audio`)
- `AudioController` singleton: state machine `idle → loading → playing(ayahId) → paused` + auto-advance ke ayat berikutnya + prefetch ayat +1.
- Implementasi platform di `web.ts` (HTMLAudioElement) & `native.ts` (Expo audio) di-balik interface yang sama; ekspor via `Platform.select`/ekstensi ganda. Screen tidak pernah tahu platform.
- Web fallback: bila audio gagal (offline/CORS), controller memancarkan `unavailable` → UI lesson degradasi ke soal non-audio (PRD § 5.4).

### 4.5 SRS (`src/core/srs`) — kerangka v1, aktif v2
- SM-2 lite: item hafalan dengan `ease`, `interval`, `dueDate`. Tabel dibuat sekarang (migration v1) supaya v2 tidak butuh migrasi merusak.

## 5. Skema Data

### SQLite (device)
```sql
-- v1 migrations (ringkas)
CREATE TABLE profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  display_name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  daily_target INTEGER NOT NULL DEFAULT 1,   -- jumlah lesson/hari
  reciter_id TEXT NOT NULL,
  arab_font_scale TEXT NOT NULL DEFAULT 'M', -- S | M | L
  reminder_hour INTEGER,                      -- NULL = off; mobile only
  streak_freeze_enabled INTEGER NOT NULL DEFAULT 1,
  onboarded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE progress_state (
  day TEXT PRIMARY KEY,            -- 'YYYY-MM-DD' WIB
  xp_total INTEGER NOT NULL,
  streak_count INTEGER NOT NULL,
  freeze_available INTEGER NOT NULL,
  -- state harian:
  lessons_today INTEGER NOT NULL DEFAULT 0,
  correct_today INTEGER NOT NULL DEFAULT 0,
  ...
);
-- lesson_log (lesson selesai), answer_log (per soal), reading_state,
-- srs_item (v2-ready), achievements (unlocked), xp_ledger (bonus quest), ayah_bookmark (favorit)
```
Skema final di `src/core/db/migrations.ts`; prinsip: **append-only untuk log** (`lesson_log`, `answer_log`) agar statistik & quest bisa dihitung ulang kapan saja; `progress_state` bisa direkonstruksi dari log (recovery path).

### Konten (JSON bundle)
```ts
// schema (zod) — divalidasi saat build & saat load pertama
SurahMeta { id: 1..114, nameAr, nameLatin, meaning, ayahCount, revelation: 'mekkah'|'madinah', juz }
TranslationEntry { surahId, ayahNo, text }   // Kemenag open data / sumber berlisensi terbuka
Reciter { id, name, urlTemplate }            // mis. https://cdn.equran.id/audio-partial/juhany/001001.mp3 (ADR-002)
```

## 6. Pipeline Konten (scripts/build-content)

Sumber final (diputus Phase 1 → [ADR-002](adr/ADR-002-sumber-konten-equran-id.md)): **equran.id (open data Kemenag) untuk semuanya** — quran.com gagal TLS di environment pengembangan, dan equran.id menyediakan semua kebutuhan dari satu sumber:
- **Teks Uthmani + metadata surah**: equran.id (validasi jumlah ayat tetap terhadap standar).
- **Terjemahan Indonesia**: equran.id (Kemenag open data, atribusi di manifest).
- **Audio**: CDN equran.id — `https://cdn.equran.id/audio-partial/{reciter}/{sss}{aaa}.mp3` (3-digit), 6 qari: `juhany`, `muhsin`, `sudais`, `dossari`, `afasy`, `yasser` ([ADR-003](adr/ADR-003-audio-engine.md)).
- **Bundling**: JSON penuh static import, tanpa lazy-load untuk v1 ([ADR-004](adr/ADR-004-bundle-konten-penuh.md)).

Langkah: `fetch → validate → emit`.
1. **Validate** (gagal = pipeline gagal, tidak ada emit):
   - Jumlah ayat per surah == standar (114 entri).
   - Checksum per file konten; diff otomatis vs bundle sebelumnya → perubahan teks Arab TIDAK BOLEH diam-diam berubah (PRD risiko #1).
   - Sampling: pipeline mencetak diff ayat yang berubah untuk review manusia.
2. **Emit**: JSON + `manifest.json` (versi, tanggal, checksum, atribusi sumber) → bundle ke app.
3. Atribusi lengkap ditampilkan di layar Profil → "Tentang & Sumber Konten". Cache fetch per-request di `.content-cache/` (gitignored) agar re-run pipeline tidak men bombardir sumber.

> Keputusan tambahan Phase 1 yang tercatat sebagai ADR: migrasi NativeWind v5 RC ([ADR-001](adr/ADR-001-nativewind-v5.md)).

## 7. Strategi Cross-Platform

| Concern | Strategi |
|---|---|
| Navigasi | expo-router; tabs di mobile, tab yang sama di web (responsive container, max-width 480 di desktop) |
| Audio | Abstraction controller (§ 4.4); `.web.ts` / `.native.ts` |
| Notifikasi | Hook `useReminder()` no-op di web; pengaturan disembunyikan |
| Safe area | `react-native-safe-area-context` di semua screen |
| Font Arab | Font custom di-bundle (`Amiri`); fallback sistem di web bila font gagal |
| Gestur/haptic | `expo-haptics` di mobile, no-op web |
| Deep link | Pola URL expo-router otomatis (`/surah/2`, `/lesson/1/0`) → share & shortcut nanti |

## 8. Strategi Testing

| Lapisan | Alat | Cakupan |
|---|---|---|
| Engine (pure) | Vitest | Wajib: streak (zona waktu), XP/level, grading lesson, quest generator, validator konten |
| Komponen kunci | React Native Testing Library | ProgressRing, QuestionCard per tipe soal, StreakFlame |
| Aset ter-generate | Vitest | Subset font (`scripts/fonts`) & ikon app (`scripts/brand`) — berkas di repo harus identik dengan hasil generator |
| Token font | Vitest | `ui/fonts.test.ts` — setiap `--font-*` di `global.css` harus punya baris override `!important` (tanpa itu body font hilang diam-diam), dan berkas fontnya harus ada + Termuat di `FONT_MAP` |
| Font transliterasi | Vitest | `ui/transliteration.test.ts` — predikat & tokenisasi kata · `scripts/fonts/transliteration-font.test.ts` — dua arah: yang Poppins tidak punya **wajib** ada di Noto Sans, yang punya **dilarang** ikut di-subset |
| Token warna | Vitest | `ui/cat-palette.test.ts` — warna SVG maskot harus sama dengan token `cat/*` di `global.css` |
| Art maskot | Vitest | `ui/cat-art.test.ts` — layer ber-id unik & berurutan, titik asal 0–100, tidak ada angka/warna rusak, kedip hanya saat mata terbuka · `scripts/brand/mascot-preview.test.ts` — pratinjau memuat SETIAP kombinasi mood × pose × varian |
| Konten suci | Vitest | `features/home/hadith.test.ts` — rotasi harian + **guard atribusi** (tanpa nomor hadis / sumber di luar Bukhari-Muslim = gagal), matn tak terpotong, tanpa huruf Latin di matn, tanpa emoji di terjemahan, dan `HadithCard` tidak boleh menyentuh `CatMascot` |
| Layar atribusi | Vitest | `features/home/about-sources.test.ts` — `app/about.tsx` wajib membaca `HADITHS` (bukan `hadithForDay`) + `contentManifest.attributions`, manifest tetap menyebut Quran/Kemenag/audio + tiap qari, dan layar tidak boleh menyentuh maskot |
| Bookmark ayat | Vitest | `core/progress/bookmark-store.test.ts` (toggle murni: urut surah:ayat, ayat sama di surah berbeda tidak saling menimpa, rollback saat repo gagal) + `core/db/progress-repo.test.ts` (INSERT OR IGNORE, composite PK, DELETE per-ayat, `ORDER BY` ada di SQL) |
| Integrasi | Vitest + in-memory sqlite / store test | Alur: jawab → XP → quest → achievement |
| Manual QA | Checklist per platform ([ROADMAP.md](ROADMAP.md) § 5) | web (Chrome + Safari), Android (device/Emulator), iOS (device/Simulator) |

**CI (GitHub Actions)**: setiap PR & push → `tsc --noEmit` + ESLint + Vitest + `expo export --platform web` (bukti web build lolos). Preview web di-deploy otomatis (Vercel/Netlify static) untuk memudahkan testing tanpa device.

## 9. Keputusan Teknis Terbuka (dibawa ke Phase 1)

> **Update akhir Phase 1**: keempat keputusan sudah diputus — catatan lengkap di `docs/adr/`.

| # | Keputusan | Hasil | ADR |
|---|---|---|---|
| 1 | Library audio final | **expo-audio** (native) + HTMLAudio (web), di balik engine abstraction | [ADR-003](adr/ADR-003-audio-engine.md) |
| 2 | Sumber terjemahan + lisensi | **equran.id (Kemenag open data)** — sumber tunggal teks+terjemahan+audio | [ADR-002](adr/ADR-002-sumber-konten-equran-id.md) |
| 3 | Metode bundling JSON | **Static import penuh** (6.236 ayat, ~1.3 MB gzip web) | [ADR-004](adr/ADR-004-bundle-konten-penuh.md) |
| 4 | Ukuran bundle & lazy-load | **Tanpa lazy-load untuk v1**; re-evaluasi jika budget startup terlampaui | [ADR-004](adr/ADR-004-bundle-konten-penuh.md) |

Keputusan scaffold tambahan: NativeWind 5.0.0-rc.0 (v4 tidak kompatibel Metro 0.84) — [ADR-001](adr/ADR-001-nativewind-v5.md).
