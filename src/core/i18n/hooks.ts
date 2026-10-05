/**
 * Owner: core/i18n. Hook pengikat locale persisten -> runtime terjemahan.
 *
 * Memakai zustand selector per-locale (bukan `useProfileStore()` tanpa selector)
 * supaya komponen hanya re-render saat bahasa benar-benar berubah, bukan setiap
 * kali setting lain di Profil berubah.
 */
import { useCallback } from "react";

import { useProfileStore } from "../progress/store";

import { DEFAULT_LOCALE, isLocale, translate, type Locale, type TranslateParams, type TranslationKey } from "./index";

/** Locale yang sedang aktif (selalu valid, walau storage berisi nilai aneh). */
export function useLocale(): Locale {
  const stored = useProfileStore((s) => s.locale);
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

export type Translator = (key: TranslationKey, params?: TranslateParams) => string;

/**
 * `t` terikat locale aktif. Contoh: `t("home.remaining", { count: 3 })`.
 *
 * Sengaja mengembalikan callback, bukan objek `{ t, locale }`, supaya call site
 * tidak perlu_city destructure dua nilai di 20 file layar.
 */
export function useT(): { t: Translator; locale: Locale; setLocale: (next: Locale) => void } {
  const locale = useLocale();
  const setLocaleStore = useProfileStore((s) => s.setLocale);
  const t = useCallback<Translator>(
    (key, params) => translate(locale, key, params),
    [locale],
  );
  const setLocale = useCallback((next: Locale) => setLocaleStore(next), [setLocaleStore]);
  return { t, locale, setLocale };
}