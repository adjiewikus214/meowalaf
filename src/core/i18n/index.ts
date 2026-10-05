/**
 * Owner: core/i18n. Runtime terjemahan: tipe locale, interpolasi parameter, dan
 * format tanggal yang ikut bahasa.
 *
 * Modul ini PURE (tanpa React) supaya bisa diuji tanpa renderer; hook-nya ada
 * di `hooks.ts`.
 *
 * Kenapa `t()` tidak memakai template literal biasakan seperti `t('halo ' + n)`:
 * karena copy-nya tidak bisa diambil ulang sebagai satu string utuh, sehingga
 * tool terjemahan (dan audit tone DESIGN.md § 5) kehilangan konteks. Semua
 * kalimat lengkap harus ada sebagai satu nilai di kamus.
 */
import { en } from "./en";
import { id, type Dictionary, type TranslationKey } from "./id";

export type { TranslationKey, Dictionary };
export { id, en };

export const LOCALES = ["id", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * Default = Indonesia. Sengaja TIDAK mengikuti bahasa perangkat: app ini
 adalah app untuk user Indonesia, dan handset yang locale-nya English (atau
 * tourist) tiba-tiba dapat UI English tanpa pernah memilih — itu kejutan yang
 * tidak perlu. Deteksi otomatis bisa jadi opsi yang SEPADATNYA ditoggle
 * "deteksi bahasa perangkat" di Profil — bukan default.
 */
export const DEFAULT_LOCALE: Locale = "id";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

const DICTIONARIES: Record<Locale, Dictionary> = { id, en };

export type TranslateParams = Record<string, string | number>;

/** Ganti `{nama}` dengan nilainya. Placeholder yang tidak ada dibiarkan utuh. */
function interpolate(template: string, params?: TranslateParams): string {
  if (params === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

/** Terjemahkan satu kunci. Kunci tidak dikenal = bug, dibiarkan mencolok. */
export function translate(locale: Locale, key: TranslationKey, params?: TranslateParams): string {
  const dictionary = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
  const template = dictionary[key] ?? DICTIONARIES[DEFAULT_LOCALE][key];
  return interpolate(template, params);
}

/** BCP-47 tag untuk `toLocaleDateString`. */
export function localeTag(locale: Locale): string {
  return locale === "en" ? "en-GB" : "id-ID";
}

/**
 * Tanggal sesi (YYYY-MM-DD, sudah hari WIB) -> "3 Okt 2026" / "3 Oct 2026".
 *
 * `new Date(`${day}T00:00:00`)` dipakai, BUKAN `new Date(day)`: bentuk kedua
 * di-parse sebagai UTC lalu diformat di zona lokal, sehingga bisa bergeser satu
 * hari di GMT+ (pola yang sama sudah diperbaiki di core/time/wib.ts).
 */
export function formatDay(locale: Locale, day: string): string {
  const parsed = new Date(`${day}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return day;
  return parsed.toLocaleDateString(localeTag(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Jumlah kunci per locale — dipakai audit layar About, bukan log. */
export function translationKeyCount(locale: Locale): number {
  return Object.keys(DICTIONARIES[locale] ?? {}).length;
}

/**
 * Label hari 3 huruf untuk sumbu X grafik: "Sen" / "Mon".
 *
 * Pindah ke sini dari core/progress/weekly.ts karena `core/progress` owns DATA,
 * bukan copy — dan "Sen"/"Mon" itu presentasi yang wajib ikut bahasa. Sumbu X
 * punya ruang sempit, jadi label penuh ("Senin"/"Monday") tidak muat; 3 huruf
 * konsisten dengan yang sudah dipakai sebelum locale ada.
 *
 * Sengaja tidak lewat `toLocaleDateString` dengan `{weekday:"short"}`: hasilnya
 * bergantung pada data ICU yang berbeda antar runtime (Node headless vs browser
 * bisa berbeda panjang), sementara sumbu grafik harus identik di keduanya.
 */
const WEEKDAY_KEYS: readonly TranslationKey[] = [
  "weekday.sun",
  "weekday.mon",
  "weekday.tue",
  "weekday.wed",
  "weekday.thu",
  "weekday.fri",
  "weekday.sat",
];

/** Input rusak → string kosong, bukan crash (grafik lalu pakai label yang ada). */
export function weekdayShort(locale: Locale, day: string): string {
  const parsed = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(parsed)) return "";
  return translate(locale, WEEKDAY_KEYS[new Date(parsed).getUTCDay()] ?? "weekday.sun");
}