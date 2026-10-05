/**
 * Owner: features/lessons. State machine sesi lesson — PURE (PRD § 5.4):
 * grading jawaban, antrean ulang (maks 1× per soal), hint, dan penyelesaian sesi.
 * Tidak menyentuh storage: keluar di tengah lesson = sesi dibuang, tidak tersimpan.
 * Konversi event → XP ada di features/gamification/xp (ARCHITECTURE.md § 4.1–4.2).
 */
import { xpForEvents } from "@/features/gamification/xp";

import { generateLessonQuestions, type GenerateOptions } from "./generator";
import type {
  LessonEvent,
  LessonSession,
  Question,
  QuestionAnswer,
  QuestionHint,
} from "./types";

export type GradeVerdict = "correct" | "wrong";

export type GradeResult = {
  /** Sesi baru (immutable — sesi lama tidak diubah). */
  session: LessonSession;
  verdict: GradeVerdict;
  /** Penjelasan inline bila salah (selalu ada untuk soal salah, PRD § 5.4). */
  feedback: string | null;
};

export type SessionResult = {
  xpEarned: number;
  /** 0..1 — benar dibagi total percobaan (termasuk percobaan ulang). */
  accuracy: number;
  /** Lesson tanpa satu pun jawaban salah (PRD: achievement "Perfect"). */
  perfect: boolean;
  events: readonly LessonEvent[];
};

export type HintResult = {
  session: LessonSession;
  hint: QuestionHint;
};

/** Membuat sesi baru. Melempar Error bila surah/unit tidak valid. */
export function startSession(surahId: number, unitIndex: number, options: GenerateOptions): LessonSession {
  const questions = generateLessonQuestions(surahId, unitIndex, options);
  if (questions.length === 0) {
    throw new Error(`Unit lesson tidak valid: surah ${surahId} unit ${unitIndex}`);
  }
  return {
    surahId,
    unitIndex,
    questions,
    retryQueue: [],
    answeredIds: [],
    retryDoneIds: [],
    hintUsedIds: [],
    retriedIds: [],
    stats: { correct: 0, wrong: 0, hintsUsed: 0 },
    events: [],
    dayWib: options.dayWib,
  };
}

/**
 * Soal berikutnya untuk UI: sisa fase utama dulu, lalu fase pengulangan.
 * null = semua soal (termasuk pengulangan) sudah dijawab → sesi bisa diselesaikan.
 */
export function getNextQuestion(session: LessonSession): Question | null {
  const main = session.questions.find((q) => !session.answeredIds.includes(q.id));
  if (main !== undefined) return main;
  const retry = session.retryQueue.find((q) => !session.retryDoneIds.includes(q.id));
  return retry ?? null;
}

/** true bila soal ini sedang/diulang dari antrean (percobaan kedua & terakhir). */
export function isRetryQuestion(session: LessonSession, questionId: string): boolean {
  return session.answeredIds.includes(questionId) && session.retryQueue.some((q) => q.id === questionId);
}

function isAnswerCorrect(question: Question, answer: QuestionAnswer): boolean {
  if (question.kind === "T2") {
    if (answer.type !== "order") return false;
    return (
      answer.order.length === question.correctOrder.length &&
      question.correctOrder.every((value, i) => answer.order[i] === value)
    );
  }
  return answer.type === "choice" && answer.index === question.correctIndex;
}

/**
 * Menilai satu jawaban. Mengembalikan null bila soal tidak ditemukan / sudah
 * dijawab (salah fase). Soal salah fase utama masuk antrean ulang maks 1×.
 */
export function gradeAnswer(
  session: LessonSession,
  questionId: string,
  answer: QuestionAnswer,
): GradeResult | null {
  const mainQuestion = session.questions.find(
    (q) => q.id === questionId && !session.answeredIds.includes(q.id),
  );
  const retryQuestion = session.retryQueue.find(
    (q) => q.id === questionId && !session.retryDoneIds.includes(q.id),
  );
  const question = mainQuestion ?? retryQuestion;
  if (question === undefined) return null;

  const isRetry = mainQuestion === undefined;
  const correct = isAnswerCorrect(question, answer);
  const withHint = session.hintUsedIds.includes(questionId);

  const stats = correct
    ? { ...session.stats, correct: session.stats.correct + 1 }
    : { ...session.stats, wrong: session.stats.wrong + 1 };

  const event: LessonEvent = correct
    ? { type: "ANSWER_CORRECT", questionId, kind: question.kind, withHint, isRetry }
    : { type: "ANSWER_WRONG", questionId, kind: question.kind, isRetry };

  let next: LessonSession = { ...session, stats, events: [...session.events, event] };

  if (mainQuestion !== undefined) {
    next = { ...next, answeredIds: [...next.answeredIds, questionId] };
    if (!correct) {
      next = {
        ...next,
        retriedIds: [...next.retriedIds, questionId],
        retryQueue: [...next.retryQueue, question],
      };
    }
  } else {
    // Fase pengulangan: tidak pernah masuk antrean lagi (maks 1×, PRD § 5.4).
    next = { ...next, retryDoneIds: [...next.retryDoneIds, questionId] };
  }

  return {
    session: next,
    verdict: correct ? "correct" : "wrong",
    feedback: correct ? null : question.explain,
  };
}

/**
 * Meminta hint (maks 1× per soal). T1/T3/T4 → eliminasi satu opsi salah;
 * T2 → perlihatkan potongan benar untuk posisi `placedCount` (jumlah yang sudah
 * diletakkan user; default 0 = potongan pertama).
 */
export function requestHint(
  session: LessonSession,
  questionId: string,
  placedCount: number = 0,
): HintResult | null {
  const question = [...session.questions, ...session.retryQueue].find((q) => q.id === questionId);
  if (question === undefined || session.hintUsedIds.includes(questionId)) return null;

  let hint: QuestionHint;
  if (question.kind === "T2") {
    const chunkIndex = question.correctOrder[placedCount];
    if (chunkIndex === undefined) return null;
    hint = { type: "reveal-position", position: placedCount, chunkIndex };
  } else {
    const eliminatedIndex = (question.correctIndex + 1) % question.options.length;
    hint = { type: "eliminate-option", eliminatedIndex };
  }

  return {
    session: {
      ...session,
      hintUsedIds: [...session.hintUsedIds, questionId],
      stats: { ...session.stats, hintsUsed: session.stats.hintsUsed + 1 },
      events: [...session.events, { type: "HINT_USED", questionId }],
    },
    hint,
  };
}

/**
 * Menyelesaikan sesi: mengembalikan null bila masih ada soal (termasuk antrean
 * ulang) yang belum dijawab — keluar di tengah lesson tidak menghasilkan XP.
 */
export function finishSession(session: LessonSession): SessionResult | null {
  if (getNextQuestion(session) !== null) return null;

  const events: readonly LessonEvent[] = [
    ...session.events,
    { type: "SESSION_COMPLETED", surahId: session.surahId, unitIndex: session.unitIndex },
  ];
  const attempts = session.stats.correct + session.stats.wrong;
  return {
    xpEarned: xpForEvents(events),
    accuracy: attempts === 0 ? 0 : session.stats.correct / attempts,
    perfect: session.stats.wrong === 0 && session.stats.correct > 0,
    events,
  };
}
