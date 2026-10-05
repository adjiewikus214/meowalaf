/**
 * Owner: features/lessons. Generator soal T1–T4 dari konten surah — PURE & deterministic:
 * seed = surahId*100 + unitIndex + tanggal WIB (ARCHITECTURE.md § 4.1) sehingga sesi yang
 * sama selalu menghasilkan soal identik, berbeda antar hari. Tanpa storage/UI.
 *
 * Ayat diambil lewat registry `core/content/ayah-source`, bukan import langsung modul
 * teks 2,6 MB: modul itu harus tetap bisa dimuat terpisah dari bundle startup
 * (docs/PERF.md). Pemanggil wajib menjalankan `ensureQuranText()` lebih dulu.
 */
import { surahAyahs as readSurahAyahs } from "@/core/content/ayah-source";
import {
  DEFAULT_RECITER_ID,
  ayahAudioUrl,
  getSurahMeta,
  type AyahContent,
} from "@/core/content/meta";
import { alignAyahWords } from "@/core/content/word-data";

import { getLessonUnit } from "./units";
import type {
  ListenMatchQuestion,
  NextAyahQuestion,
  OrderAyahQuestion,
  Question,
  QuestionKind,
  QuestionOptions,
  SelectTranslationQuestion,
} from "./types";

export const MIN_QUESTIONS_PER_LESSON = 4;
export const MAX_QUESTIONS_PER_LESSON = 6;
export const MIN_T2_WORDS = 3;
export const MAX_T2_CHUNKS = 6;

export type GenerateOptions = {
  /** Tanggal WIB (YYYY-MM-DD) — sumber determinisme, wajib eksplisit. */
  dayWib: string;
  /** false → T4 dilewati (degradasi elegan saat audio tak tersedia, PRD § 5.4). */
  includeListenQuestions?: boolean;
  /** Qari untuk URL audio T4. */
  reciterId?: string;
};

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — tanpa Math.random agar lintas-platform deterministik.
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFor(surahId: number, unitIndex: number, dayWib: string): number {
  const dayNumber = Number(dayWib.replaceAll("-", ""));
  return (surahId * 100 + unitIndex + dayNumber) >>> 0;
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}

function takeUnique(pool: readonly string[], count: number, rng: () => number): string[] {
  const picked: string[] = [];
  for (const item of shuffle(pool, rng)) {
    if (picked.length >= count) break;
    if (item !== "" && !picked.includes(item)) picked.push(item);
  }
  return picked;
}

function toTriple(items: readonly string[]): QuestionOptions {
  const [a, b, c] = items;
  if (a === undefined || b === undefined || c === undefined) {
    throw new Error("Opsi soal harus tepat 3");
  }
  return [a, b, c];
}

function shuffledOptions(correct: string, distractors: readonly string[], rng: () => number): { options: QuestionOptions; correctIndex: number } {
  const options = toTriple(shuffle([correct, ...distractors], rng));
  return { options, correctIndex: options.indexOf(correct) };
}

/** Kata ayat ter-align (Langkah 3 ADR-005): teks inti equran.id tanpa token marka;
 *  batas kata mengikuti word-data bila sejajar 1:1. */
function ayahWords(ayah: AyahContent): string[] {
  return alignAyahWords(ayah.surahId, ayah.ayahNumber, ayah.arabic).map((w) => w.text);
}

// ---------------------------------------------------------------------------
// Builder per tipe soal. Distractor diambil dari terjemahan/awal ayat surah yang sama,
// dijamin unik & ≠ jawaban benar; bila kurang → builder mengembalikan null.
// ---------------------------------------------------------------------------

type DistractorSource = {
  surahAyahs: readonly AyahContent[];
};

function translationPool(source: DistractorSource, exclude: string): string[] {
  const unique = [...new Set(source.surahAyahs.map((a) => a.translation))];
  return unique.filter((t) => t !== exclude);
}

function buildT1(ayah: AyahContent, source: DistractorSource, rng: () => number): SelectTranslationQuestion | null {
  const distractors = takeUnique(translationPool(source, ayah.translation), 2, rng);
  if (distractors.length < 2) return null;
  const { options, correctIndex } = shuffledOptions(ayah.translation, distractors, rng);
  return {
    kind: "T1",
    id: "",
    surahId: ayah.surahId,
    ayahNumber: ayah.ayahNumber,
    ayahArabic: ayah.arabic,
    options,
    correctIndex,
    explain: ayah.translation,
  };
}

function buildChunks(words: readonly string[]): string[] {
  if (words.length <= MAX_T2_CHUNKS) return [...words];
  // Kelompokkan kata berurutan menjadi MAX_T2_CHUNKS potongan sebesar mungkin sama.
  const base = Math.floor(words.length / MAX_T2_CHUNKS);
  const extra = words.length % MAX_T2_CHUNKS;
  const chunks: string[] = [];
  let cursor = 0;
  for (let i = 0; i < MAX_T2_CHUNKS; i++) {
    const size = base + (i < extra ? 1 : 0);
    chunks.push(words.slice(cursor, cursor + size).join(" "));
    cursor += size;
  }
  return chunks;
}

function buildT2(ayah: AyahContent, rng: () => number): OrderAyahQuestion | null {
  const words = ayahWords(ayah);
  if (words.length < MIN_T2_WORDS) return null;
  const chunks = buildChunks(words);
  // Item berpasangan teks+indeks asli agar kata duplikat tetap terlacak posisinya.
  let display = shuffle(chunks.map((text, idx) => ({ text, idx })), rng);
  if (chunks.length > 1) {
    for (let guard = 0; guard < 4 && display.every((item, i) => item.idx === i); guard++) {
      display = shuffle(display, rng); // hindari tampilan sudah berurutan
    }
  }
  const chunksDisplay = display.map((item) => item.text);
  // Urutan benar = posisi-tampil dari potongan berindeks-asli 0,1,2,...
  const correctOrder = chunks.map((_, originalIdx) => {
    const position = display.findIndex((item) => item.idx === originalIdx);
    if (position === -1) throw new Error("Potongan T2 hilang — bug generator");
    return position;
  });
  return {
    kind: "T2",
    id: "",
    surahId: ayah.surahId,
    ayahNumber: ayah.ayahNumber,
    translation: ayah.translation,
    chunks: chunksDisplay,
    correctOrder,
    explain: ayah.translation,
  };
}

function ayahStart(ayah: AyahContent): string {
  const words = ayahWords(ayah);
  return words.slice(0, Math.ceil(words.length / 2)).join(" ");
}

function buildT3(ayah: AyahContent, next: AyahContent, source: DistractorSource, rng: () => number): NextAyahQuestion | null {
  const correct = ayahStart(next);
  const promptStart = ayahStart(ayah);
  const pool = [...new Set(source.surahAyahs.map((a) => ayahStart(a)))].filter(
    (start) => start !== correct && start !== promptStart,
  );
  const distractors = takeUnique(pool, 2, rng);
  if (distractors.length < 2) return null;
  const { options, correctIndex } = shuffledOptions(correct, distractors, rng);
  return {
    kind: "T3",
    id: "",
    surahId: ayah.surahId,
    ayahNumber: ayah.ayahNumber,
    ayahStart: promptStart,
    options,
    correctIndex,
    explain: next.translation,
  };
}

function buildT4(ayah: AyahContent, reciterId: string, source: DistractorSource, rng: () => number): ListenMatchQuestion | null {
  const distractors = takeUnique(translationPool(source, ayah.translation), 2, rng);
  if (distractors.length < 2) return null;
  const { options, correctIndex } = shuffledOptions(ayah.translation, distractors, rng);
  return {
    kind: "T4",
    id: "",
    surahId: ayah.surahId,
    ayahNumber: ayah.ayahNumber,
    audioUrl: ayahAudioUrl(reciterId, ayah.surahId, ayah.ayahNumber),
    options,
    correctIndex,
    explain: ayah.translation,
  };
}

// ---------------------------------------------------------------------------
// Komposisi soal: satu dari tiap tipe yang tersedia dulu (variasi), lalu diisi
// siklus T3/T1 hingga jumlah target (4–6 soal per PRD § 5.4).
// ---------------------------------------------------------------------------

export function generateLessonQuestions(surahId: number, unitIndex: number, options: GenerateOptions): Question[] {
  const meta = getSurahMeta(surahId);
  const unit = getLessonUnit(surahId, unitIndex);
  if (meta === undefined || unit === undefined) return [];

  const surahAyahs = readSurahAyahs(surahId);
  const unitAyahs = surahAyahs.slice(unit.startAyah - 1, unit.endAyah);
  if (unitAyahs.length === 0) return [];

  const rng = mulberry32(seedFor(surahId, unitIndex, options.dayWib));
  const includeT4 = options.includeListenQuestions ?? true;
  const reciterId = options.reciterId ?? DEFAULT_RECITER_ID;
  const source: DistractorSource = { surahAyahs };

  const nextOf = (ayah: AyahContent): AyahContent | undefined =>
    unitAyahs.find((a) => a.ayahNumber === ayah.ayahNumber + 1);

  const t1Pool = shuffle([...unitAyahs], rng);
  const t2Pool = shuffle(unitAyahs.filter((a) => ayahWords(a).length >= MIN_T2_WORDS), rng);
  const t3Pool = shuffle(
    unitAyahs.flatMap((ayah) => {
      const next = nextOf(ayah);
      return next === undefined ? [] : [{ ayah, next }];
    }),
    rng,
  );
  const t4Pool = includeT4 ? shuffle([...unitAyahs], rng) : [];

  type Builder = () => Question | null;

  const t1Builder = (): Question | null => {
    for (let i = 0; i < t1Pool.length; i++) {
      const ayah = t1Pool.shift();
      if (ayah === undefined) return null;
      const q = buildT1(ayah, source, rng);
      if (q !== null) return q;
      t1Pool.push(ayah);
    }
    return null;
  };
  const t2Builder = (): Question | null => {
    for (let i = 0; i < t2Pool.length; i++) {
      const ayah = t2Pool.shift();
      if (ayah === undefined) return null;
      const q = buildT2(ayah, rng);
      if (q !== null) return q;
      t2Pool.push(ayah);
    }
    return null;
  };
  const t3Builder = (): Question | null => {
    for (let i = 0; i < t3Pool.length; i++) {
      const candidate = t3Pool.shift();
      if (candidate === undefined) return null;
      const q = buildT3(candidate.ayah, candidate.next, source, rng);
      if (q !== null) return q;
      t3Pool.push(candidate);
    }
    return null;
  };
  const t4Builder = (): Question | null => {
    for (let i = 0; i < t4Pool.length; i++) {
      const ayah = t4Pool.shift();
      if (ayah === undefined) return null;
      const q = buildT4(ayah, reciterId, source, rng);
      if (q !== null) return q;
      t4Pool.push(ayah);
    }
    return null;
  };

  const builders: Record<QuestionKind, Builder> = {
    T1: t1Builder,
    T2: t2Builder,
    T3: t3Builder,
    T4: t4Builder,
  };

  const queue: QuestionKind[] = ["T1"];
  if (t2Pool.length > 0) queue.push("T2");
  if (t3Pool.length > 0) queue.push("T3");
  if (t4Pool.length > 0) queue.push("T4");
  const fillKinds: QuestionKind[] = ["T3", "T1"];
  const fallbackOrder: QuestionKind[] = ["T4", "T3", "T2", "T1"];

  const wanted = Math.min(MAX_QUESTIONS_PER_LESSON, Math.max(MIN_QUESTIONS_PER_LESSON, unitAyahs.length));
  const questions: Question[] = [];

  const tryBuild = (kind: QuestionKind): Question | null => builders[kind]();

  for (const kind of queue) {
    if (questions.length >= wanted) break;
    const q = tryBuild(kind);
    if (q !== null) questions.push(q);
  }
  for (let fillIdx = 0; questions.length < wanted; fillIdx++) {
    const primary = fillKinds[fillIdx % fillKinds.length];
    if (primary === undefined) break;
    let q = tryBuild(primary);
    if (q === null) {
      for (const kind of fallbackOrder) {
        q = tryBuild(kind);
        if (q !== null) break;
      }
    }
    if (q === null) break; // semua pool habis
    questions.push(q);
  }

  return questions.map((q, index) => ({ ...q, id: `q${index + 1}` }));
}
