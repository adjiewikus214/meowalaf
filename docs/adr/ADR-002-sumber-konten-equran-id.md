# ADR-002 — Sumber tunggal equran.id untuk teks, terjemahan, metadata, dan audio

> **Status**: Diterima · **Tanggal**: 2026-10-01 · **Konteks**: Phase 1 pipeline konten
> Referensi: [ARCHITECTURE.md](../ARCHITECTURE.md) § 6, [RULES.md](../RULES.md) § 7–8

## Konteks

Rencana awal memisahkan sumber: quran.com API v4 (teks Uthmani), Kemenag open data
(terjemahan), everyayah/qurancentral (audio). Realita environment:

- `api.quran.com` **gagal TLS** (`SEC_E_UNTRUSTED_ROOT` via proxy) — tidak dapat dipakai.
- `equran.id` (open data Kemenag) **dapat diakses** dan menyediakan semua yang dibutuhkan:
  teks Arab, terjemahan Indonesia, metadata 114 surah, DAN CDN audio 6 qari dengan pola URL
  per ayat yang konsisten.

Dua sumber terpisah berarti dua titik kegagalan jaringan + dua skema validator, tanpa
manfaat nyata untuk v1.

## Keputusan

Pipeline konten memakai **satu sumber: equran.id** untuk semuanya.

- URL audio: `https://cdn.equran.id/audio-partial/{reciter}/{sss}{aaa}.mp3` (nomor 3-digit,
  surah & ayat masing-masing zero-padded 3 digit).
- Reciter id: `juhany`, `muhsin`, `sudais`, `dossari`, `afasy`, `yasser`.
- Atribusi: equran.id / Kemenag open data — tercatat di `manifest.json`, wajib tampil di
  layar "Tentang & Sumber Konten" sebelum rilis ([RULES.md](../RULES.md) § 7.6).
- Pipeline `fetch → validate → emit` tidak berubah; jumlah ayat per surah tetap divalidasi
  terhadap standar, checksum di manifest, diff teks Arab untuk review manusia.

## Konsekuensi

- (+) Satu skema validator, satu cache fetch, atribusi tunggal yang sederhana.
- (+) Data Kemenag resmi — sesuai target produk Indonesia.
- (−) Ketergantungan satu penyedia: bila equran.id down/berubah skema, pipeline berhenti
  (fail-fast by design; bundle ter-emit tetap aman di `src/data/content/`).
- Bila nanti perlu sumber cadangan (mis. teks Uthmani pihak ketiga), validator per-surah
  sudah isolir sehingga penambahan sumber = fetcher baru, bukan rombak.
