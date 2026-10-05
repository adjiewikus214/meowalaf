/**
 * Guard RULES § 7.6 — layar "Tentang & Sumber Konten" adalah release blocker,
 * jadi yang dijaga di sini adalah *kelengkapan*: tidak ada sumber yang boleh
 * hilang dari layar.
 *
 * Batasnya sama seperti `hadith.test.ts`: test ini membuktikan setiap entri
 * punya tempat di layar, tidak bahwa nomor hadisnya benar. Kebenaran nomor
 * hanya bisa dijawab review manusia (RULES § 7.7).
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { contentManifest, reciters } from "@/core/content/meta";
import { HADITHS } from "@/features/home/hadith";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const ABOUT_SCREEN = path.join(ROOT, "app", "about.tsx");

describe("RULES § 7.6: atribusi tampil sebelum rilis publik", () => {
  it("layar About menampilkan setiap entri hadis, bukan cuma yang hari ini", () => {
    // Kalau layar ini ikut memakai `hadithForDay`, isinya akan berubah tiap
    // hari dan 5 dari 6 entri tidak pernah terlihat user — itu bukan
    // atribusi, itu endogenous. Sumbernya harus `HADITHS` (seluruh daftar).
    const source = fs.readFileSync(ABOUT_SCREEN, "utf8");
    expect(source).toContain("HADITHS");
    expect(source).not.toContain("hadithForDay");
    expect(source).toContain("attributionKey");
  });

  it("menampilkan setiap entri hadis beserta rawi & nomornya", () => {
    // `attributionKey` dibaca per entri di dalam map, jadi cukup menjamin setiap
    // entri punya kunci yang tervalidasi di kedua locale.
    for (const h of HADITHS) {
      expect(h.attributionKey, h.id).toBeTruthy();
      expect(h.textKey, h.id).toBeTruthy();
    }
  });

  it("menampilkan seluruh atribusi dari manifest bundle", () => {
    // Manifest adalah hasil pipeline: kalau nanti ada sumber baru (mis.
    // tafsir), ia otomatis masuk ke `manifest.attributions`. Layar ini
    // merendernya apa adanya, jadi sumber baru tidak bisa "terlupa".
    const source = fs.readFileSync(ABOUT_SCREEN, "utf8");
    expect(source).toContain("contentManifest.attributions");
    expect(contentManifest.attributions.length).toBeGreaterThan(0);
  });

  it("manifest tetap menyebut teks, terjemahan, audio, dan tiap qari", () => {
    // Kalau someday pipeline berhenti mengemit atribusi, layar tetap tampil
    // rapi — tapi jadi kosong, dan itu tidak terlihat: tidak ada test
    // lain yang menangkap decreased isi layar ini. Karena itu isi manifest
    // ikut dijaga, bukan cuma kode yang merendernya.
    const joined = contentManifest.attributions.join(" | ");
    expect(joined).toMatch(/equran\.id/);
    expect(joined).toMatch(/Kementerian Agama/);
    expect(joined).toMatch(/Audio murottal/);
    for (const r of reciters) {
      expect(joined, `qari ${r.id} tidak tercatat`).toContain(r.name);
    }
  });

  it("tidak pernah menyentuh maskot di layar atribusi (BRAND § 6.1)", () => {
    const source = fs.readFileSync(ABOUT_SCREEN, "utf8");
    expect(source, "maskot tidak boleh dekat atribusi teks suci").not.toMatch(/CatMascot|CatPaw/);
  });
});
