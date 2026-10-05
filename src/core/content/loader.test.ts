import { describe, expect, it } from "vitest";

import { getSurahAyahs, quranUthmani, translationId } from "./loader";
import { ayahAudioUrl, contentManifest, getSurahMeta, reciters, surahMetadata } from "./meta";

describe("bundle konten", () => {
  it("memuat 114 surah metadata", () => {
    expect(surahMetadata).toHaveLength(114);
  });

  it("total ayat = 6236 (standar)", () => {
    const total = surahMetadata.reduce((acc, s) => acc + s.ayahCount, 0);
    expect(total).toBe(6236);
    expect(contentManifest.ayahCount).toBe(6236);
  });

  it("surah pertama & terakhir benar", () => {
    expect(getSurahMeta(1)?.nameLatin).toBe("Al-Fatihah");
    expect(getSurahMeta(114)?.nameLatin).toBe("An-Nas");
  });

  it("Al-Fatihah punya 7 ayat lengkap dengan pasangan Arab+terjemahan", () => {
    const ayahs = getSurahAyahs(1);
    expect(ayahs).toHaveLength(7);
    expect(ayahs[0]?.arabic).toContain("اللّٰهِ");
    expect(ayahs[0]?.translation).toContain("Allah");
  });

  it("Al-Baqarah ayat 255 ada (Ayat Kursi)", () => {
    expect(quranUthmani["2"]?.["255"]).toBeDefined();
    expect(translationId["2"]?.["255"]).toBeDefined();
  });

  it("setiap surah punya pasangan teks lengkap (tak ada ayat telanjang)", () => {
    for (const meta of surahMetadata) {
      const ayahs = getSurahAyahs(meta.id);
      expect(ayahs).toHaveLength(meta.ayahCount);
    }
  });

  it("url audio pakai pola 3-digit surah+ayat", () => {
    const url = ayahAudioUrl(reciters[0]!.id, 1, 1);
    expect(url).toMatch(/001001\.mp3$/);
    const url2 = ayahAudioUrl("sudais", 114, 6);
    expect(url2).toMatch(/Abdurrahman-as-Sudais\/114006\.mp3$/);
  });

  it("qari tidak dikenal → fallback ke qari pertama", () => {
    const url = ayahAudioUrl("tidak-ada", 2, 3);
    expect(url).toMatch(new RegExp(`${reciters[0]!.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/002003`));
  });
});
