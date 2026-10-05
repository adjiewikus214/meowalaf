import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { en, id } from "@/core/i18n";
import { HADITHS, hadithForDay } from "./hadith";

/** Emoji & simbol dekoratif — RULES § 7.5 melarangnya di dekat teks suci. */
const EMOJI = /\p{Extended_Pictographic}|[\u2190-\u21FF\u2600-\u27BF]/u;

const ROOT = path.resolve(__dirname, "..", "..", "..");

describe("rotasi hadis harian", () => {
  it("hari yang sama selalu memberi hadis yang sama", () => {
    // Tanda tangan fungsi ini murni (tanggal -> entri), jadi tidak ada state
    // yang bisa membuat hadis berganti di tengah hari.
    expect(hadithForDay("2026-10-04").id).toBe(hadithForDay("2026-10-04").id);
  });

  it("berganti tiap hari dan berputar penuh tanpa mengulang lebih awal", () => {
    const seen = new Set<string>();
    for (let i = 0; i < HADITHS.length; i += 1) {
      const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      seen.add(hadithForDay(day).id);
    }
    expect(seen.size).toBe(HADITHS.length);
  });

  it("menyeberangi batas bulan tanpa melompati entri", () => {
    // 31 Jan -> 1 Feb tetap satu langkah: yang menyeberang adalah aritmetika
    // hari epoch, bukan tanggal mentah.
    expect(hadithForDay("2026-02-01").id).not.toBe(hadithForDay("2026-01-31").id);
  });

  it("tanggal rusak jatuh ke entri pertama, bukan undefined", () => {
    // "2026-13-99" adalah kasus yang paling boa: tanpa guard roll-over, Date
    // merolldate itu jadi 2027-04-09 yang terlihat sah.
    expect(hadithForDay("bukan-tanggal").id).toBe(HADITHS[0].id);
    expect(hadithForDay("").id).toBe(HADITHS[0].id);
    expect(hadithForDay("2026-13-99").id).toBe(HADITHS[0].id);
  });

  it("tidak ada id hadis yang duplikat", () => {
    expect(new Set(HADITHS.map((h) => h.id)).size).toBe(HADITHS.length);
  });
});

describe("bentuk entri hadis (kelengkapan, bukan kebenaran)", () => {
  it("setiap entri punya matn Arab yang tidak kosong", () => {
    // Ambang 15 dipilih supaya hadis terpendek di daftar ini (الْكَلِمَةُ الطَّيِّبَةُ
    // صَدَقَةٌ = 16 huruf Arab) tetap lolos, sementara matn yang terpotong atau
    // belum diisi — penyebab paling umum saat menyalin teks dari sumber — gagal.
    for (const h of HADITHS) {
      const arabicLetters = h.arabic.replace(/[^\p{Script=Arabic}]/gu, "");
      expect(arabicLetters.length, `${h.id} matn kosong`).toBeGreaterThan(15);
    }
  });

  it("setiap kunci terjemahan ada & terisi di kedua locale", () => {
    for (const h of HADITHS) {
      for (const [locale, dict] of [
        ["id", id],
        ["en", en],
      ] as const) {
        expect(dict[h.textKey], `${locale}.${h.textKey}`).toBeTruthy();
        expect(dict[h.attributionKey], `${locale}.${h.attributionKey}`).toBeTruthy();
      }
    }
  });

  it("WAJIB ada nomornya: atribusi tidak boleh tanpa nomor hadis", () => {
    // Kutipan tanpa sumber adalah defect. Ini versi otomatis dari aturan BRAND
    // yang dulu melarang hadis di Home, dan sekarang mengharuskannya
    // diberi sumber yang jelas.
    for (const h of HADITHS) {
      const attribution = id[h.attributionKey];
      expect(attribution, `${h.id} tanpa nomor`).toMatch(/\d{3,4}/);
      expect(attribution, `${h.id} bukan dari Bukhari/Muslim`).toMatch(/Bukhari|Muslim/);
    }
  });

  it("terjemahan tidak pernah memakai emoji (RULES § 7.5)", () => {
    for (const h of HADITHS) {
      for (const dict of [id, en]) {
        expect(dict[h.textKey], h.id).not.toMatch(EMOJI);
        expect(dict[h.attributionKey], h.id).not.toMatch(EMOJI);
      }
    }
  });

  it("terjemahan SELALU diawali huruf besar, di kedua locale", () => {
    // Terjadi nyata saat kartu ini pertama dibuat: terjemahannya mengikuti gaya
    // `tip.*` yang memang sengaja huruf kecil untuk meta-experience, padahal
    // hadis itu konten suci. Aturan di src/core/i18n/id.ts: copy yang menyentuh
    // ayat/ibadah formal & hormat — huruf kecil di awal kalimat undermines it.
    for (const h of HADITHS) {
      for (const [locale, dict] of [
        ["id", id],
        ["en", en],
      ] as const) {
        const value = dict[h.textKey];
        expect(value[0], `${locale}.${h.textKey} diawali huruf kecil`).toBe(
          value[0]?.toUpperCase(),
        );
      }
    }
  });

  it("matn tidak pernah memuat huruf Latin (kesalahan ketik paling umum)", () => {
    // Teks Arab yang salah ketik tidak selalu kelihatan salah di layar — hanya
    // terlalunfamili. Huruf Latin di dalam matn hampir selalu salah tempel.
    for (const h of HADITHS) {
      expect(h.arabic, `${h.id} memuat huruf Latin`).not.toMatch(/[A-Za-z]/);
    }
  });
});

describe("BRAND.md § 6.1: maskot tidak pernah bersebelahan dengan teks suci", () => {
  it("HadithCard tidak mengimpor maupun merender CatMascot", () => {
    const file = path.join(ROOT, "src", "ui", "components", "HadithCard.tsx");
    const source = fs.readFileSync(file, "utf8");
    expect(source, "maskot tidak boleh dekat teks hadis").not.toMatch(/CatMascot/);
  });
});