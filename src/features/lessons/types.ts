/**
 * Owner: features/lessons. Kontrak domain lesson — tipe soal T1–T4, jawaban,
 * sesi, event, dan hint (PRD § 5.4). Murni tipe & konstanta: tanpa logika,
 * boleh di-import features lain (termasuk gamification) dan app/.
 */

// Tipe soal (PRD § 5.4):
// T1 Pilih Arti      — ayat Arab → pilih terjemahan yang benar (3 opsi).
// T2 Susun Ayat      — terjemahan → susun potongan kata Arab urutan benar (tap-to-place).
// T3 Lanjutan Ayat   — awal ayat N → pilih awal ayat berikutnya yang benar.
// T4 Dengar & Pilih  — audio ayat → pilih terjemahan yang cocok.
export const QUESTION_KINDS = ["T1", "T2", "T3", "T4"] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

/** Tiga opsi untuk soal pilihan (T1/T3/T4). */
export type QuestionOptions = readonly [string, string, string];

type QuestionBase = {
  /** Id unik dalam satu sesi (q1, q2, ...). */
  id: string;
  surahId: number;
  /** Ayat utama yang diujikan (1-based). */
  ayahNumber: number;
  /** Penjelasan feedback inline bila salah — selalu ada (PRD § 5.4). */
  explain: string;
};

export type SelectTranslationQuestion = QuestionBase & {
  kind: "T1";
  ayahArabic: string;
  options: QuestionOptions;
  correctIndex: number;
};

export type OrderAyahQuestion = QuestionBase & {
  kind: "T2";
  /** Terjemahan penuh sebagai prompt. */
  translation: string;
  /** Potongan kata Arab — SUDAH teracak untuk tampilan (indeks = posisi tampil). */
  chunks: readonly string[];
  /** Urutan indeks `chunks` (posisi tampil) untuk merekonstruksi ayat benar. */
  correctOrder: readonly number[];
};

export type NextAyahQuestion = QuestionBase & {
  kind: "T3";
  /** Awal ayat N (setengah kata pertama). */
  ayahStart: string;
  options: QuestionOptions;
  correctIndex: number;
};

export type ListenMatchQuestion = QuestionBase & {
  kind: "T4";
  audioUrl: string;
  options: QuestionOptions;
  correctIndex: number;
};

export type Question =
  | SelectTranslationQuestion
  | OrderAyahQuestion
  | NextAyahQuestion
  | ListenMatchQuestion;

export type ChoiceAnswer = { type: "choice"; index: number };
export type OrderAnswer = { type: "order"; order: readonly number[] };
export type QuestionAnswer = ChoiceAnswer | OrderAnswer;

/** Hint per soal — maks 1× per soal; jawaban benar dengan hint XP-nya −1 (PRD § 5.5). */
export type QuestionHint =
  | { type: "eliminate-option"; eliminatedIndex: number }
  | { type: "reveal-position"; position: number; chunkIndex: number };

export type LessonStats = {
  correct: number;
  wrong: number;
  hintsUsed: number;
};

/**
 * Event sesi — dipakai engine gamification untuk menghitung XP
 * (ARCHITECTURE.md § 4.1: lesson mengirim event, XP dihitung engine gamification).
 */
export type LessonEvent =
  | { type: "ANSWER_CORRECT"; questionId?: string; kind: QuestionKind; withHint: boolean; isRetry: boolean }
  | { type: "ANSWER_WRONG"; questionId?: string; kind: QuestionKind; isRetry: boolean }
  | { type: "HINT_USED"; questionId: string }
  | { type: "SESSION_COMPLETED"; surahId: number; unitIndex: number };

export type LessonSession = {
  surahId: number;
  unitIndex: number;
  /** Urutan main fase utama. */
  questions: readonly Question[];
  /** Salinan soal yang menunggu pengulangan di akhir sesi (maks 1×). */
  retryQueue: readonly Question[];
  /** Id soal yang sudah dijawab di fase utama. */
  answeredIds: readonly string[];
  /** Id soal yang sudah dijawab ulang di fase pengulangan. */
  retryDoneIds: readonly string[];
  /** Id soal yang sudah memakai hint (maks 1× per soal). */
  hintUsedIds: readonly string[];
  /** Id soal yang pernah masuk antrean ulang — tidak di-queue lagi. */
  retriedIds: readonly string[];
  stats: LessonStats;
  events: readonly LessonEvent[];
  /** Tanggal WIB pembuatan sesi — sumber determinisme seed. */
  dayWib: string;
};
