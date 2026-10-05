# ADR-003 — Audio per ayat: CDN equran.id + engine abstraction web/native

> **Status**: Diterima · **Tanggal**: 2026-10-01 · **Konteks**: Phase 1 mushaf audio
> Referensi: [ARCHITECTURE.md](../ARCHITECTURE.md) § 4.4 & § 7, [ROADMAP.md](../ROADMAP.md) § 7 (spike audio)

## Konteks

Kebutuhan: play/pause per ayat, auto-advance ke ayat berikut, dan state gagal yang rapi
(offline) — di **web** dan **native** dari satu codebase. Spike audio (keputusan terbuka #1)
dimenangkan `expo-audio` (mengikuti arah SDK 57; `expo-av` menuju deprecation).
API native dan web tidak identik; autoplay browser hanya mengizinkan play dari gesture user.

## Keputusan

1. **URL audio**: pola equran.id — `https://cdn.equran.id/audio-partial/{reciter}/{sss}{aaa}.mp3`
   (3-digit), 6 qari (`juhany`, `muhsin`, `sudais`, `dossari`, `afasy`, `yasser`);
   `DEFAULT_RECITER_ID = "juhany"` di `src/core/content/loader.ts`.
2. **Arsitektur**: `AudioController` (state machine singleton, token race-guard) memakai
   engine di balik interface; pilihan engine via `Platform.select`:
   - `engine.web.ts` → `HTMLAudioElement` (satu elemen, seek/pause saat ganti ayat).
   - `engine.native.ts` → `expo-audio` player.
   - `engine-index.ts` satu-satunya yang menyentuh `Platform` — controller tidak tahu platform.
3. **Autoplay policy**: play programatik tanpa gesture dianggap ketidakpastian platform, bukan
   bug — auto-advance hanya lanjut bila sesi audio dimulai dari tap user.

## Konsekuensi

- (+) Controller + state machine dapat di-unit-test tanpa platform (Vitest, stub engine).
- (+) Menambah platform/engine baru = satu file engine, bukan perubahan controller.
- (−) Dua implementasi engine harus dijaga paralel (web terverifikasi di QA browser; native
  via Expo Go = manual-check tersisa di device).
