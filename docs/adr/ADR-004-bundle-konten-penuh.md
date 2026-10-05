# ADR-004 — Bundle konten JSON penuh (statis) untuk v1

> **Status**: Diterima · **Tanggal**: 2026-10-01 · **Konteks**: Phase 1 keputusan bundling
> Referensi: [ARCHITECTURE.md](../ARCHITECTURE.md) § 6 & § 9 (keputusan terbuka #3, #4)

## Konteks

Keputusan terbuka #3 (require statis vs asset terpisah) dan #4 (bundle penuh vs lazy-load
per juz) harus diputus di Phase 1. Kondisi terukur: hasil emit 114 surah / 6.236 ayat
(JSON) + ekspor web ~1.3 MB gzip — masih jauh di bawah budget bundle web 8 MB
([RULES.md](../RULES.md) § 9).

## Keputusan

- **Bundle penuh, static import**: seluruh `src/data/content/*.json` dibawa dalam bundle,
  di-parse zod saat load pertama (`src/core/content/loader.ts`), tanpa fetch runtime.
- Tidak ada lazy-load per juz untuk v1; ukuran diukur ulang tiap Phase via `expo export`.

## Konsekuensi

- (+) Offline-first penuh: teks, navigasi, dan metadata audio jalan tanpa jaringan (hanya
  audio streaming yang butuh online) — sesuai kriteria exit Phase 1.
- (+) Nol kompleksitas: tanpa async chunking, tanpa state "surah belum terunduh".
- (−) Startup mem-parse lebih banyak JSON dari yang layar butuh; jika budget startup
  (< 2.0s, RULES § 9 — target ini kemudian diganti [ADR-008](ADR-008-budget-startup-fast-4g-bukan-slow-4g.md)) terlampaui di Phase 3, rencana fallback: per-juz chunking atau
  lazy-import per surah — keputusan itu akan jadi ADR baru.
