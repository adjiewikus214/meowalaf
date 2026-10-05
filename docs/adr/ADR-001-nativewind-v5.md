# ADR-001 — Migrasi NativeWind v4 → v5 RC untuk Metro baru

> **Status**: Diterima · **Tanggal**: 2026-10-01 · **Konteks**: Phase 1 scaffold
> Referensi: [ARCHITECTURE.md](../ARCHITECTURE.md) § 4, [RULES.md](../RULES.md) § 12

## Konteks

Phase 1 memakai Expo SDK 57 (React Native 0.86, Metro 0.84). NativeWind v4 stabil gagal
total di pasangan ini: Metro 0.84 mengubah API transformer internal, sehingga pipeline v4
melempar `TypeError: ... 'transformFile'` dan build tidak pernah jalan.

## Keputusan

Migrasi ke **NativeWind 5.0.0-rc.0 + react-native-css 3.1.0-rc.0 + Tailwind CSS 4.1.12**, dengan setup v5:

- `postcss.config.mjs` dengan `@tailwindcss/postcss`; `lightningcss` di-pin `1.30.1` lewat
  `overrides` di `package.json` (versi lain memicu error native binding).
- `global.css` memakai token Tailwind v4 `@theme` (bg-base, brand-emerald, ink-primary, dst);
  **tanpa** `tailwind.config.js`.
- `metro.config.js`: `withNativewind(config)` tanpa `input`.
- `babel.config.js`: plain `babel-preset-expo` (di-install eksplisit — SDK template tidak
  selalu menyertakannya).
- `nativewind-env.d.ts`: `/// <reference types="react-native-css/types" />` untuk typing class names.

## Konsekuensi

- (+) Build web & Metro jalan kembali; token design system hidup di satu file `global.css`.
- (−) Dependensi RC: resiko breaking change sebelum stabil. Mitigasi: versi di-pin persis,
  upgrade hanya lewat commit tersendiri + gate typecheck/lint/test.
- (−) Dokumentasi v5 masih berubah; setup dicatat di file konfigurasi repo ini sebagai acuan.
- Re-evaluasi saat NativeWind 5 stable dirilis (upgrade terjadwal, bukan diam-diam).
