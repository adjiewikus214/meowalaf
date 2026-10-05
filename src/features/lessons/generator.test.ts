import { describe, expect, it } from "vitest";

import { getSurahAyahs } from "@/core/content/loader";
import { alignAyahWords, isMarkOnlyToken } from "@/core/content/word-data";

import { generateLessonQuestions, MAX_QUESTIONS_PER_LESSON, MIN_QUESTIONS_PER_LESSON } from "./generator";
import { getLessonUnit } from "./units";

const DAY_A = "2026-10-01";
const DAY_B = "2026-10-02";

describe("generateLessonQuestions — determinisme", () => {
  it("sesi sama (surah+unit+hari) → soal identik", () => {
    const a = generateLessonQuestions(1, 0, { dayWib: DAY_A });
    const b = generateLessonQuestions(1, 0, { dayWib: DAY_A });
    expect(a).toEqual(b);
  });

  it("hari berbeda → urutan/opsi berbeda (seed berganti)", () => {
    const a = generateLessonQuestions(2, 0, { dayWib: DAY_A });
    const b = generateLessonQuestions(2, 0, { dayWib: DAY_B });
    expect(a).not.toEqual(b);
  });

  it("unit berbeda pada hari sama → soal berbeda", () => {
    const u0 = generateLessonQuestions(2, 0, { dayWib: DAY_A });
    const u1 = generateLessonQuestions(2, 1, { dayWib: DAY_A });
    expect(u0).not.toEqual(u1);
  });
});

describe("generateLessonQuestions — kontrak soal", () => {
  it("jumlah soal 4–6 dan id berurutan", () => {
    for (const surahId of [1, 36, 112]) {
      const unit = getLessonUnit(surahId, 0);
      const questions = generateLessonQuestions(surahId, 0, { dayWib: DAY_A });
      expect(questions.length).toBeGreaterThanOrEqual(MIN_QUESTIONS_PER_LESSON);
      expect(questions.length).toBeLessThanOrEqual(MAX_QUESTIONS_PER_LESSON);
      expect(questions.length).toBeLessThanOrEqual(unit?.ayahCount ?? 0);
      questions.forEach((q, i) => expect(q.id).toBe(`q${i + 1}`));
    }
  });

  it("T1: opsi unik, tepat satu benar, explain = terjemahan ayat", () => {
    const questions = generateLessonQuestions(1, 0, { dayWib: DAY_A });
    const t1 = questions.filter((q) => q.kind === "T1");
    expect(t1.length).toBeGreaterThan(0);
    for (const q of t1) {
      if (q.kind !== "T1") continue;
      expect(new Set(q.options).size).toBe(3);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(3);
      expect(q.ayahArabic.length).toBeGreaterThan(0);
      const ayah = getSurahAyahs(1).find((a) => a.ayahNumber === q.ayahNumber);
      expect(q.explain).toBe(ayah?.translation);
      expect(q.options[q.correctIndex]).toBe(ayah?.translation);
    }
  });

  it("T2: susunan potongan merekonstruksi ayat Arab asli", () => {
    // Al-Baqarah unit 0 punya ayat panjang → hampir pasti ada T2; coba juga surah lain.
    for (const surahId of [2, 36, 1]) {
      const questions = generateLessonQuestions(surahId, 0, { dayWib: DAY_A });
      const t2 = questions.find((q) => q.kind === "T2");
      if (t2 === undefined) continue;
      if (t2.kind !== "T2") continue;
      expect(t2.chunks.length).toBeGreaterThanOrEqual(3);
      expect(t2.chunks.length).toBeLessThanOrEqual(6);
      const rebuilt = t2.correctOrder.map((displayPos) => t2.chunks[displayPos]).join(" ");
      const ayah = getSurahAyahs(surahId).find((a) => a.ayahNumber === t2.ayahNumber);
      // Referensi = kata ter-align (teks inti tanpa token marka) — kontrak Langkah 3 ADR-005.
      const alignedWords = alignAyahWords(surahId, t2.ayahNumber, ayah?.arabic ?? "").map((w) => w.text);
      expect(rebuilt).toBe(alignedWords.join(" "));
      // Semua indeks posisi tampil valid & unik.
      expect([...t2.correctOrder].sort((a, b) => a - b)).toEqual(t2.chunks.map((_, i) => i));
      return;
    }
    throw new Error("Tidak ada satu pun soal T2 di sample — generator kurang variasi");
  });

  it("T3: ayahStart adalah awal (paruh kata ter-align) ayat berikutnya", () => {
    const questions = generateLessonQuestions(36, 0, { dayWib: DAY_A });
    const t3 = questions.find((q) => q.kind === "T3");
    if (t3 === undefined) throw new Error("T3 tidak tergenerate untuk surah 36 unit 0");
    if (t3.kind !== "T3") return;
    const next = getSurahAyahs(36).find((a) => a.ayahNumber === t3.ayahNumber + 1);
    expect(next).toBeDefined();
    const nextWords = alignAyahWords(36, t3.ayahNumber + 1, next?.arabic ?? "").map((w) => w.text);
    expect(t3.options[t3.correctIndex]).toBe(
      nextWords.slice(0, Math.ceil(nextWords.length / 2)).join(" "),
    );
  });

  it("T2: tidak ada chunk yang murni marka standalone", () => {
    for (const surahId of [1, 78, 112]) {
      const questions = generateLessonQuestions(surahId, 0, { dayWib: DAY_A });
      for (const q of questions) {
        if (q.kind !== "T2") continue;
        expect(q.chunks.every((c) => !isMarkOnlyToken(c))).toBe(true);
      }
    }
  });

  it("T4: audioUrl pola CDN equran.id", () => {
    const questions = generateLessonQuestions(1, 0, { dayWib: DAY_A });
    const t4 = questions.find((q) => q.kind === "T4");
    expect(t4).toBeDefined();
    if (t4?.kind !== "T4") return;
    expect(t4.audioUrl).toMatch(/^https:\/\/cdn\.equran\.id\/audio-partial\/[A-Za-z-]+\/\d{6}\.mp3$/);
    expect(new Set(t4.options).size).toBe(3);
  });

  it("includeListenQuestions: false → tidak ada T4", () => {
    const questions = generateLessonQuestions(1, 0, { dayWib: DAY_A, includeListenQuestions: false });
    expect(questions.some((q) => q.kind === "T4")).toBe(false);
    expect(questions.length).toBeGreaterThanOrEqual(MIN_QUESTIONS_PER_LESSON);
  });

  it("reciterId kustom mengubah URL audio T4", () => {
    const questions = generateLessonQuestions(1, 0, { dayWib: DAY_A, reciterId: "sudais" });
    const t4 = questions.find((q) => q.kind === "T4");
    expect(t4?.kind === "T4" && t4.audioUrl.includes("Abdurrahman-as-Sudais")).toBe(true);
  });

  it("surah/unit tidak valid → array kosong (bukan throw)", () => {
    expect(generateLessonQuestions(999, 0, { dayWib: DAY_A })).toEqual([]);
    expect(generateLessonQuestions(1, 5, { dayWib: DAY_A })).toEqual([]);
  });
});
