import { describe, expect, it } from "vitest";

import { surahMetadata } from "../content/meta";
import { en, id, LOCALES, DEFAULT_LOCALE, formatDay, isLocale, translate, translationKeyCount } from "./index";
import type { Dictionary, TranslationKey } from "./index";

const DICTIONARIES: Record<string, Dictionary | undefined> = { id, en };

/** Kamus satu locale dengan tipe pasti (index Record<string, ...> bermasalah di strict). */
const dictionaryFor = (locale: (typeof LOCALES)[number]): Dictionary => (locale === "en" ? en : id);

/** Emoji & simbol dekoratif — yang RULES § 7.5 larang di dekat teks suci. */
const EMOJI = /\p{Extended_Pictographic}|[\u2190-\u21FF\u2600-\u27BF]/u;

describe("kamus i18n", () => {
  it("semua locale punya kunci yang persis sama", () => {
    const base = Object.keys(id).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(DICTIONARIES[locale] ?? {}).sort(), `locale ${locale}`).toEqual(base);
    }
    expect(base.length).toBeGreaterThan(100);
  });

  it("tidak ada nilai kosong di locale mana pun", () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(DICTIONARIES[locale] ?? {})) {
        expect(value.trim(), `${locale}.${key} kosong`).not.toBe("");
      }
    }
  });

  it("placeholder yang dipakai di id juga ada di en (dan sebaliknya)", () => {
    const placeholders = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "").sort();
    for (const key of Object.keys(id) as TranslationKey[]) {
      expect(placeholders(en[key]), `en.${key}`).toEqual(placeholders(id[key]));
    }
  });

  it("nilai tidak pernah memuat escape unicode yang rusak (literal \"U0001f4d6\")", () => {
    // Terjadi nyata saat kamus en.ts pertama ditulis: beberapa emoji masuk sebagai
    // teks "U0001f4d6", jadi tampilannya bukan emoji tapi kode hex. Tidak ada
    // test lain yang akan menangkap ini, dan di layar cuma terlihat seperti
    // salah ketik.
    const broken: string[] = [];
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(DICTIONARIES[locale] ?? {})) {
        if (/U000[0-9a-fA-F]{4}|\{[0-9a-fA-F]{4}\}/.test(value)) broken.push(`${locale}.${key}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("RULES § 7.5: nama surah tidak pernah bersebelahan dengan emoji", () => {
    // Aturan ini nyata dan bisa diotomatisasi: kalau copy menyebut nama surah,
    // Area di sekitarnya harus resmi - tanpa emoji, tanpa slang.
    const offenders: string[] = [];
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(DICTIONARIES[locale] ?? {})) {
        const mentionsSurah = surahMetadata.some((s) => value.includes(s.nameLatin));
        if (mentionsSurah && EMOJI.test(value)) offenders.push(`${locale}.${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("RULES § 7.5: blok ayat tidak pernah memakai emoji", () => {
    // Kunci yang isinya menyebut ayat/surah dalam konteks bacaan (bukan meta).
    const ayahKeys = (Object.keys(id) as TranslationKey[]).filter((k) => /^lesson\.(materiLabel|ayahOpenedWith)/.test(k));
    expect(ayahKeys.length).toBeGreaterThan(0);
    for (const locale of LOCALES) {
      const dictionary = dictionaryFor(locale);
      for (const key of ayahKeys) {
        expect(dictionary[key], `${locale}.${key}`).not.toMatch(EMOJI);
      }
    }
  });
});

describe("translate()", () => {
  it("mengembalikan copy sesuai locale", () => {
    expect(translate("id", "home.continue")).toBe("Lanjut Ngaji");
    expect(translate("en", "home.continue")).toBe("Continue Reciting");
  });

  it("menyisipkan parameter", () => {
    expect(translate("id", "home.remaining", { count: 3 })).toBe("sisa 3 lesson lagi buat jaga streak 🔥");
    expect(translate("en", "lesson.headerQuestion", { position: 2, total: 5 })).toBe("question 2 of 5");
  });

  it("placeholder yang tidak diberi parameter dibiarkan utuh (bukan 'undefined')", () => {
    // Diam-diam jadi string "undefined" adalah bug yang baru terlihat jauh dari
    // tempat penyebabnya, jadi ini dibiarkan kelihatan.
    expect(translate("id", "home.remaining")).toContain("{count}");
  });

  it("locale tak dikenal jatuh ke default, bukan error", () => {
    const weird = "jp" as never;
    expect(translate(weird, "tabs.home")).toBe(translate(DEFAULT_LOCALE, "tabs.home"));
  });

  it("isLocale hanya menerima locale yang terdaftar", () => {
    expect(isLocale("id")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("formatDay()", () => {
  it("memakai bulan sesuai locale", () => {
    expect(formatDay("id", "2026-10-03")).toBe("3 Okt 2026");
    expect(formatDay("en", "2026-10-03")).toBe("3 Oct 2026");
  });

  it("tidak bergeser sehari di zona GMT+", () => {
    // Regresi: `new Date("2026-10-03")` di-parse UTC lalu diformat lokal bisa
    // jadi 2 Oktober di GMT+7. Bentuk dengan T00:00:00 yang dipakai.
    expect(formatDay("id", "2026-01-01")).toContain("1");
    expect(formatDay("id", "2026-01-01")).not.toContain("31");
  });

  it("input rusak dikembalikan apa adanya, bukan 'Invalid Date'", () => {
    expect(formatDay("id", "bukan-tanggal")).toBe("bukan-tanggal");
  });
});

describe("translationKeyCount()", () => {
  it("menghitung kunci per locale (dipakai audit layar About)", () => {
    expect(translationKeyCount("id")).toBe(Object.keys(id).length);
    expect(translationKeyCount("en")).toBe(Object.keys(en).length);
  });
});