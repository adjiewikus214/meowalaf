# ADR-006 — Sumber glos per kata Indonesia: QUL "Indonesian wbw translation"

> **Status**: Diterima (kondisional) · **Tanggal**: 2026-10-01 · **Konteks**: lanjutan [ADR-005](ADR-005-quranhub-mcp-enrichment.md) Langkah 3
> Referensi: [RULES.md](../RULES.md) § 7.6–7.8 (lisensi & atribusi), § 7.7 (review manusia), [PRD.md](../PRD.md) § 5.5

## Konteks

Quest harian **"tebak arti kata"** (PRD § 5.5) tertunda karena glos per kata Indonesia tidak
tersedia via QuranHub MCP (bukti di [ADR-005](ADR-005-quranhub-mcp-enrichment.md) Langkah 2).
Riset sumber alternatif dilakukan 2026-10-01.

## Kandidat dievaluasi

| Kandidat | Temuan | Putusan |
|---|---|---|
| **QUL (Tarteel) — resource #96 "Indonesian wbw translation"** | Ada & terverifikasi via preview: glos Indonesia natural (أَوْ→"atau", وَرَتِّلِ→"dan bacalah", تَرْتِيلًا→"perlahan-lahan"); **99% lengkap** (3 kata missing dari 77.435); format JSON + sqlite; dipakai Quran for Android/iOS | ✅ **Dipilih** |
| Quran Foundation API (api.quran.foundation) | word-by-word translation via `words=true`, tapi bahasa glos publik terbatas ( Inggris) + butuh API key; domain lain berpotensi kena masalah TLS yang sama | Cadangan |
| npm `@kmaslesa/holy-quran-word-by-word-full-data` | Lisensi paket ISC, tapi provenance & hak konten tidak terdokumentasi | ❌ (RULES § 7.8) |
| Scrape dataset "Kemenag per kata" di GitHub | Provenance tidak resmi (dump tanpa izin terdokumentasi) | ❌ (RULES § 7.8) |

## Keputusan

1. **Sumber**: QUL resource #96 — unduhan JSON (butuh **akun gratis**; tombol unduhan
   mengarah ke login). File ditaruh manual ke `.content-cache/` (gitignored), lalu diolah
   pipeline — pola sama dengan ADR-005 (bukan import langsung, RULES § 7.2).
2. **Scope awal**: Al-Fatihah + Juz 30 (paralel dengan `word-data-juz30.json`) → emit
   `word-gloss-juz30.json`; perluasan 114 surah menyusul bila quest terbukti populer.
3. **Alignment**: keying QUL mengikuti segmentasi kata standar (satu keluarga dengan token
   `location` quran.com yang sudah kita simpan) → validasi count-per-ayat terhadap
   `word-data-juz30.json`; ayat yang tidak sejajar ditandai & tidak di-emit (pola Langkah 2).
4. **Lisensi**: FAQ QUL eksplisit — data boleh dipakai komersial, dengan lisensi
   **per-resource**; resource ber-copyright ditandai jelas di listing (mis. German wbw,
   Clear Quran), dan **Indonesian wbw tidak ber-tanda ©**. Tetap wajib: buka halaman
   resource saat unduhan pertama, catat lisensi + kredit penerjemah ke manifest (RULES § 7.6).

## Langkah verifikasi wajib saat unduhan pertama (sebelum emit apa pun)

1. Catat **lisensi & kredit penerjemah** dari halaman `qul.tarteel.ai/resources/translation/96`
   → masuk `manifest.attributions` + layar "Tentang & Sumber Konten".
2. Cek **struktur JSON** word-by-word (keying `verse_key`, urutan kata) — bandingkan 3 ayat
   sampel (1:1, 112:1, 84:21) dengan token `word-data-juz30.json`.
3. Count-check 571 ayat scope vs token bundle; sampling review manusia min. 5 ayat
   (RULES § 7.7) sebelum emit.

## Konsekuensi

- (+) Quest "tebak arti kata" bisa hidup untuk Al-Fatihah + Juz 30 tanpa sumber baru di
  runtime — data statis, offline-first tetap terjaga.
- (−) Unduhan manual ber-akun → tidak otomatis di CI; re-run pipeline hanya bila file cache
  diperbarui (fail-soft, sama dengan ADR-005).
- (−) 3 kata missing (99%) → 3 token tanpa glos; quest skip kata tersebut (fallback), bukan
  gagal pipeline.
- Bila verifikasi langkah 1–3 gagal (lisensi terungkap ber-copyright / struktur tak cocok),
  ADR ini ditinjau ulang dan quest tetap ditunda.

## Status verifikasi (2026-10-01, pipeline dibangun — emit menunggu file)

- **Struktur JSON terkonfirmasi** dari dokumentasi resmi halaman resource #96: JSON
  QUL = objek flat ber-key `surah:ayah:word` (location quran.com, mulai dari 1), glos
  saja tanpa teks Arab — identik dengan keying `WordToken.location` di
  `word-data-juz30.json`, jadi penggabungan cukup join location (tanpa perataan teks).
- **Pipeline** (`scripts/build-content/word-gloss.ts`, `word-gloss-validate.ts`,
  `emit-word-gloss.ts`, `main-word-gloss.ts`, `npm run content:word-gloss`): parser
  multi-bentuk (flat/wrapper/array) + discovery nama file bebas di `.content-cache/`,
  validasi 3 langkah (lisensi → sampel 1:1/112:1/84:21 → count-check 571 ayat),
  ambang emit ayat ≥95% token berglos, fail-fast tanpa emit bila file absen/issue.
  Test unit 18 kasus tanpa jaringan (total suite 143/143).
- **Langkah 1–3 belum dieksekusi end-to-end** — file JSON unduhan user belum ada di
  `.content-cache/` (dicek 2026-10-01: hanya cache mcp-*/surah-*). Begitu file ditaruh,
  jalankan `npm run content:word-gloss` → laporan sampel + coverage tercetak; wajib
  ditutup review manusia min. 5 ayat (RULES § 7.7) sebelum quest dihidupkan.
- Lisensi resmi tercatat sebagai atribusi default per-resource QUL (FAQ QUL:
  komersial OK, resource ber-© ditandai eksplisit; Indonesian wbw tidak ber-©). Bila
  file `*licen*/*kredit*` ditaruh di `.content-cache/`, isinya jadi sumber atribusi
  tambahan yang dilaporkan pipeline.
