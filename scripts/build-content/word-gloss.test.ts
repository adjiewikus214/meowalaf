import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { collectGlossCandidates, findQulGlossCandidates, readLicenseNotes, scanContentCache } from "./word-gloss";
import { SAMPLE_AYAHS, validateGlossData, type GlossWordDataSource } from "./word-gloss-validate";
import type { WordToken } from "./word-data";

describe("collectGlossCandidates", () => {
  it("bentuk flat sesuai dokumentasi QUL (location → glos) terdeteksi", () => {
    const doc = JSON.stringify({
      "1:1:1": "Dengan (nama)",
      "1:1:2": "Allah",
      "112:1:1": "Katakanlah",
    });
    const candidates = collectGlossCandidates("qul.json", doc);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.shape).toBe("flat");
    expect(candidates[0]?.glosses["112:1:1"]).toBe("Katakanlah");
  });

  it("nilai berupa objek {text} tetap diekstrak", () => {
    const doc = JSON.stringify({
      "1:1:1": { text: "Dengan (nama)" },
      "1:1:2": { text: "Allah" },
    });
    const { glosses } = collectGlossCandidates("qul.json", doc)[0]!;
    expect(glosses["1:1:1"]).toBe("Dengan (nama)");
  });

  it("objek non-lokasi (meta surah) tidak dianggap peta glos", () => {
    const doc = JSON.stringify({ name: "Al-Fatihah", ayahs: 7, bismillah: true });
    expect(collectGlossCandidates("x.json", doc)).toEqual([]);
  });

  it("array entri {surah_number, ayah_number, word_number, text} terdeteksi", () => {
    const doc = JSON.stringify([
      { surah_number: 1, ayah_number: 1, word_number: 1, text: "Dengan (nama)" },
      { surah_number: 1, ayah_number: 1, word_number: 2, text: "Allah" },
    ]);
    const candidates = collectGlossCandidates("qul.json", doc);
    expect(candidates[0]?.shape).toBe("array");
    expect(candidates[0]?.glosses["1:1:2"]).toBe("Allah");
  });

  it("wrapper (mis. {qul: {...}}) diekstrak dengan nama properti", () => {
    const doc = JSON.stringify({
      meta: "Indonesian wbw",
      data: { "112:1:1": "Katakanlah", "112:1:2": "Dia" },
    });
    const candidates = collectGlossCandidates("qul.json", doc);
    expect(candidates[0]?.shape).toBe("wrapper");
    expect(candidates[0]?.from).toBe("data");
    expect(candidates[0]?.glosses["112:1:1"]).toBe("Katakanlah");
  });

  it("JSON rusak → tanpa kandidat", () => {
    expect(collectGlossCandidates("x.json", "{ tidak valid")).toEqual([]);
  });

  it("findQulGlossCandidates mengurutkan kandidat terbesar dulu", () => {
    const big = JSON.stringify(Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`1:${i + 1}:1`, `g${i}`])));
    const small = JSON.stringify({ "112:1:1": "Katakanlah" });
    const sorted = findQulGlossCandidates([
      { file: "small.json", raw: small },
      { file: "big.json", raw: big },
    ]);
    expect(sorted[0]?.file).toBe("big.json");
  });
});

describe("scanContentCache", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "ayatin-gloss-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("menemukan file QUL dengan nama bebas, skip cache mcp-/surah-", async () => {
    writeFileSync(path.join(dir, "indonesian_wbw.json"), JSON.stringify({ "112:1:1": "Katakanlah", "112:1:2": "Dia" }));
    writeFileSync(path.join(dir, "mcp-words-112-v1.json"), JSON.stringify({ "112:1:1": "bukan glos" }));
    writeFileSync(path.join(dir, "surah-list-v1.json"), JSON.stringify([{ id: 1 }]));
    const candidates = await scanContentCache(dir);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.file).toBe("indonesian_wbw.json");
  });

  it("folder kosong/tidak ada → tanpa kandidat (fail-fast di entry)", async () => {
    expect(await scanContentCache(path.join(dir, "tidak-ada"))).toEqual([]);
  });

  it("readLicenseNotes membaca file lisensi/credit non-JSON", async () => {
    writeFileSync(path.join(dir, "qul-license.md"), "CC-by-SA contoh");
    writeFileSync(path.join(dir, "acak.txt"), "bukan lisensi");
    const notes = await readLicenseNotes(dir);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.file).toBe("qul-license.md");
  });
});

function token(pos: number, location: string): WordToken {
  return { pos, text: `ك${pos}`, location };
}

function wordsSource(ayahTokens: WordToken[]): GlossWordDataSource {
  return { tokensBySurah: { "112": { "1": ayahTokens } } };
}

describe("validateGlossData", () => {
  const tokens112 = [token(1, "112:1:1"), token(2, "112:1:2"), token(3, "112:1:3"), token(4, "112:1:4")];

  it("glos lengkap → ayat di-emit, tanpa issue; sampel 112:1 tercatat", () => {
    const source = {
      glosses: { "112:1:1": "Katakanlah", "112:1:2": "Dia", "112:1:3": "Allah", "112:1:4": "satu" },
      licenseNotes: [{ file: "qul-license.md", content: "QUL" }],
    };
    const result = validateGlossData(source, wordsSource(tokens112), [112]);
    expect(result.issues).toEqual([]);
    expect(result.glosses["112"]?.["1"]).toEqual([
      { pos: 1, gloss: "Katakanlah" },
      { pos: 2, gloss: "Dia" },
      { pos: 3, gloss: "Allah" },
      { pos: 4, gloss: "satu" },
    ]);
    const sample = result.samples.find((s) => s.surahId === 112);
    expect(sample?.matched).toBe(4);
    expect(result.coverage.ayahsFullyCovered).toBe(1);
  });

  it("peta glos kosong → issue (gagal)", () => {
    const result = validateGlossData({ glosses: {}, licenseNotes: [] }, wordsSource(tokens112), [112]);
    expect(result.issues).toHaveLength(1);
    expect(result.glosses).toEqual({});
  });

  it("token tanpa glos di bawah ambang → ayat tidak di-emit + warning", () => {
    const source = {
      glosses: { "112:1:1": "Katakanlah", "112:1:2": "Dia" },
      licenseNotes: [{ file: "qul-license.md", content: "QUL" }],
    };
    const result = validateGlossData(source, wordsSource(tokens112), [112]);
    expect(result.issues).toEqual([]);
    expect(result.glosses["112"]).toBeUndefined();
    expect(result.warnings.some((w) => w.scope === "112:1")).toBe(true);
  });

  it("sampel tanpa glos sama sekali → issue (keying salah)", () => {
    const source = { glosses: { "1:1:1": "Dengan" }, licenseNotes: [] };
    const result = validateGlossData(source, wordsSource(tokens112), [112]);
    const sampleIssue = result.issues.find((i) => i.problem.includes("112:1"));
    expect(sampleIssue).toBeDefined();
  });

  it("sampel 112:1 dengan glos parsial dilaporkan, tapi tidak di-emit (ambang seragam)", () => {
    const source = {
      glosses: { "112:1:1": "Katakanlah", "112:1:2": "Dia", "112:1:3": "Allah" },
      licenseNotes: [{ file: "qul-license.md", content: "QUL" }],
    };
    const result = validateGlossData(source, wordsSource(tokens112), [112]);
    expect(result.issues).toEqual([]);
    expect(result.glosses["112"]).toBeUndefined();
    expect(result.samples[0]?.matched).toBe(3);
    expect(result.samples[0]?.missing).toEqual(["112:1:4"]);
    expect(result.warnings.some((w) => w.scope === "112:1")).toBe(true);
  });

  it("tanpa catatan lisensi → warning atribusi default", () => {
    const source = {
      glosses: { "112:1:1": "Katakanlah", "112:1:2": "Dia", "112:1:3": "Allah", "112:1:4": "satu" },
      licenseNotes: [],
    };
    const result = validateGlossData(source, wordsSource(tokens112), [112]);
    expect(result.warnings.some((w) => w.scope === "license")).toBe(true);
  });

  it("surah scope tidak ada di word-data → issue", () => {
    const source = { glosses: { "112:1:1": "Katakanlah" }, licenseNotes: [] };
    const result = validateGlossData(source, { tokensBySurah: {} }, [112]);
    expect(result.issues.some((i) => i.problem.includes("tidak ada di word-data"))).toBe(true);
  });

  it("SAMPLE_AYAHS sesuai ADR-006: 1:1, 112:1, 84:21", () => {
    expect(SAMPLE_AYAHS).toEqual([
      { surahId: 1, ayahNumber: 1 },
      { surahId: 112, ayahNumber: 1 },
      { surahId: 84, ayahNumber: 21 },
    ]);
  });
});
