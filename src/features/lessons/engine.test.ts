import { describe, expect, it } from "vitest";

import { finishSession, getNextQuestion, gradeAnswer, isRetryQuestion, requestHint, startSession } from "./engine";
import { generateLessonQuestions } from "./generator";
import type { LessonSession, OrderAyahQuestion, Question } from "./types";

const OPTS = { dayWib: "2026-10-01" } as const;

function correctAnswerFor(question: Question): { type: "choice"; index: number } | { type: "order"; order: readonly number[] } {
  if (question.kind === "T2") return { type: "order", order: [...question.correctOrder] };
  return { type: "choice", index: question.correctIndex };
}

function answerAllMainCorrectly(session: LessonSession): LessonSession {
  let current = session;
  for (;;) {
    const next = getNextQuestion(current);
    if (next === null || current.answeredIds.includes(next.id)) break;
    const result = gradeAnswer(current, next.id, correctAnswerFor(next));
    if (result === null) throw new Error(`gradeAnswer null untuk ${next.id}`);
    current = result.session;
  }
  return current;
}

function findQuestion(session: LessonSession, kind: "T1" | "T2" | "T3" | "T4"): Question | undefined {
  return session.questions.find((q) => q.kind === kind);
}

function makeT2Session(): { session: LessonSession; question: OrderAyahQuestion } {
  for (const surahId of [1, 2, 36, 112]) {
    const session = startSession(surahId, 0, OPTS);
    const t2 = findQuestion(session, "T2");
    if (t2 !== undefined && t2.kind === "T2") return { session, question: t2 };
  }
  throw new Error("Tidak ada T2 di sample surah");
}

describe("startSession", () => {
  it("sesi baru: kosong antrean & statistik", () => {
    const session = startSession(1, 0, OPTS);
    expect(session.surahId).toBe(1);
    expect(session.unitIndex).toBe(0);
    expect(session.questions.length).toBeGreaterThanOrEqual(4);
    expect(session.retryQueue).toHaveLength(0);
    expect(session.stats).toEqual({ correct: 0, wrong: 0, hintsUsed: 0 });
  });

  it("unit tidak valid → throw (fail fast)", () => {
    expect(() => startSession(1, 9, OPTS)).toThrow();
    expect(() => startSession(999, 0, OPTS)).toThrow();
  });
});

describe("gradeAnswer", () => {
  it("jawaban benar → verdict correct, tidak masuk antrean ulang", () => {
    const session = startSession(1, 0, OPTS);
    const first = getNextQuestion(session);
    expect(first).not.toBeNull();
    const result = gradeAnswer(session, first!.id, correctAnswerFor(first!));
    expect(result?.verdict).toBe("correct");
    expect(result?.feedback).toBeNull();
    expect(result?.session.answeredIds).toEqual([first!.id]);
    expect(result?.session.retryQueue).toHaveLength(0);
    expect(result?.session.stats.correct).toBe(1);
  });

  it("jawaban salah → feedback = explain, soal masuk antrean ulang", () => {
    const session = startSession(1, 0, OPTS);
    const first = getNextQuestion(session)!;
    const wrong = first.kind === "T2"
      ? { type: "order" as const, order: [...first.correctOrder].reverse() }
      : { type: "choice" as const, index: (first.correctIndex + 1) % 3 };
    const result = gradeAnswer(session, first.id, wrong);
    expect(result?.verdict).toBe("wrong");
    expect(result?.feedback).toBe(first.explain);
    expect(result?.session.retryQueue.map((q) => q.id)).toEqual([first.id]);
    expect(result?.session.stats.wrong).toBe(1);
  });

  it("soal yang sudah dijawab tidak bisa dijawab lagi (salah fase)", () => {
    const session = startSession(1, 0, OPTS);
    const first = getNextQuestion(session)!;
    const once = gradeAnswer(session, first.id, correctAnswerFor(first!));
    expect(gradeAnswer(once!.session, first.id, correctAnswerFor(first!))).toBeNull();
  });

  it("urutan jawaban T2 yang salah → wrong", () => {
    const { session, question } = makeT2Session();
    const wrongOrder = [...question.correctOrder];
    const tmp = wrongOrder[0];
    wrongOrder[0] = wrongOrder[1]!;
    wrongOrder[1] = tmp!;
    const result = gradeAnswer(session, question.id, { type: "order", order: wrongOrder });
    expect(result?.verdict).toBe("wrong");
    expect(result?.feedback).toBe(question.explain);
  });
});

describe("antrean ulang (PRD § 5.4: maks 1×)", () => {
  it("soal salah muncul lagi SETELAH semua soal utama, lalu selesai", () => {
    let session = startSession(1, 0, OPTS);
    const wrongIds: string[] = [];
    // Jawab semua soal utama — soal pertama sengaja salah.
    for (;;) {
      const next = getNextQuestion(session);
      if (next === null || session.answeredIds.includes(next.id)) break;
      const isFirst = session.answeredIds.length === 0;
      const answer = isFirst && next.kind !== "T2"
        ? { type: "choice" as const, index: (next.correctIndex + 1) % 3 }
        : correctAnswerFor(next);
      if (isFirst && next.kind === "T2") {
        wrongIds.push(next.id);
        session = gradeAnswer(session, next.id, { type: "order", order: [...next.correctOrder].reverse() })!.session;
        continue;
      }
      const result = gradeAnswer(session, next.id, answer);
      if (isFirst) wrongIds.push(next.id);
      session = result!.session;
    }
    expect(wrongIds).toHaveLength(1);
    const [wrongId] = wrongIds;
    // Fase utama selesai → soal salah muncul sekali lagi.
    const retry = getNextQuestion(session);
    expect(retry?.id).toBe(wrongId);
    expect(isRetryQuestion(session, wrongId!)).toBe(true);
    // Jawab ulang dengan benar → sesi habis.
    const result = gradeAnswer(session, wrongId!, correctAnswerFor(retry!));
    expect(result?.verdict).toBe("correct");
    expect(getNextQuestion(result!.session)).toBeNull();
    // Pengulangan kedua tidak pernah ditawarkan.
    expect(result!.session.retryDoneIds).toEqual([wrongId]);
  });

  it("soal salah DI PENGULANGAN tidak masuk antrean lagi (maks 1×)", () => {
    let session = startSession(1, 0, OPTS);
    // Salahkan soal pertama.
    const first = getNextQuestion(session)!;
    const wrongFirst = first.kind === "T2"
      ? { type: "order" as const, order: [...first.correctOrder].reverse() }
      : { type: "choice" as const, index: (first.correctIndex + 1) % 3 };
    session = gradeAnswer(session, first.id, wrongFirst)!.session;
    // Jawab benar semua soal utama tersisa.
    for (;;) {
      const next = getNextQuestion(session);
      if (next === null || session.answeredIds.includes(next.id)) break;
      session = gradeAnswer(session, next.id, correctAnswerFor(next))!.session;
    }
    // Fase pengulangan: salah LAGI.
    const retryId = getNextQuestion(session)!.id;
    const retryQ = session.retryQueue.find((q) => q.id === retryId)!;
    const wrongAgain = retryQ.kind === "T2"
      ? { type: "order" as const, order: [...retryQ.correctOrder].reverse() }
      : { type: "choice" as const, index: (retryQ.correctIndex + 1) % 3 };
    const retried = gradeAnswer(session, retryId, wrongAgain)!;
    expect(retried.verdict).toBe("wrong");
    // Habis — tidak ada pengulangan kedua.
    expect(getNextQuestion(retried.session)).toBeNull();
    expect(finishSession(retried.session)).not.toBeNull();
  });
});

describe("requestHint", () => {
  it("hint pilihan ganda mengeliminasi opsi salah", () => {
    const session = startSession(1, 0, OPTS);
    const q = findQuestion(session, "T1") ?? findQuestion(session, "T3") ?? findQuestion(session, "T4");
    expect(q).toBeDefined();
    const result = requestHint(session, q!.id, 0);
    expect(result?.hint.type).toBe("eliminate-option");
    if (result?.hint.type !== "eliminate-option") return;
    const eliminated = q!.kind !== "T2" ? q!.options[result.hint.eliminatedIndex] : undefined;
    expect(eliminated).not.toBe(q!.kind !== "T2" ? q!.options[q!.correctIndex] : undefined);
    expect(result.session.hintUsedIds).toEqual([q!.id]);
    expect(result.session.stats.hintsUsed).toBe(1);
  });

  it("hint T2 memperlihatkan potongan benar pada posisi berjalan", () => {
    const { session, question } = makeT2Session();
    const result = requestHint(session, question.id, 0);
    expect(result?.hint).toEqual({ type: "reveal-position", position: 0, chunkIndex: question.correctOrder[0] });
    const second = requestHint(result!.session, question.id, 1);
    expect(second).toBeNull(); // maks 1× per soal
  });

  it("hint dua kali untuk soal sama → null", () => {
    const session = startSession(1, 0, OPTS);
    const q = session.questions[0]!;
    const first = requestHint(session, q.id, 0);
    expect(first).not.toBeNull();
    expect(requestHint(first!.session, q.id, 0)).toBeNull();
  });

  it("soal tidak dikenal → null", () => {
    const session = startSession(1, 0, OPTS);
    expect(requestHint(session, "q999", 0)).toBeNull();
  });
});

describe("finishSession", () => {
  it("masih ada soal tersisa → null (lesson belum selesai)", () => {
    const session = startSession(1, 0, OPTS);
    expect(finishSession(session)).toBeNull();
  });

  it("lesson semua benar → perfect, akurasi 1", () => {
    const session = answerAllMainCorrectly(startSession(1, 0, OPTS));
    const result = finishSession(session);
    expect(result).not.toBeNull();
    expect(result?.perfect).toBe(true);
    expect(result?.accuracy).toBe(1);
    expect(result?.xpEarned).toBe(session.questions.length * 3 + 5 + 2);
  });

  it("verify PRD § 5.5: 5 soal, semua benar tanpa hint = 15 + 5 + 2 = 22 XP", () => {
    // Cari sesi dengan tepat 5 soal.
    for (const surahId of [1, 2, 36, 67, 97, 112, 113, 114]) {
      const session = startSession(surahId, 0, OPTS);
      if (session.questions.length !== 5) continue;
      const done = answerAllMainCorrectly(session);
      const result = finishSession(done);
      expect(result?.xpEarned).toBe(22);
      return;
    }
    throw new Error("Tidak menemukan sesi 5 soal di sample — sesuaikan sample");
  });

  it("sesi dengan salah diulang-benar: perfect=false, akurasi dihitung dari total percobaan", () => {
    let session = startSession(1, 0, OPTS);
    const first = getNextQuestion(session)!;
    const wrong = first.kind === "T2"
      ? { type: "order" as const, order: [...first.correctOrder].reverse() }
      : { type: "choice" as const, index: (first.correctIndex + 1) % 3 };
    session = gradeAnswer(session, first.id, wrong)!.session;
    for (;;) {
      const next = getNextQuestion(session);
      if (next === null || session.answeredIds.includes(next.id)) break;
      session = gradeAnswer(session, next.id, correctAnswerFor(next))!.session;
    }
    const retryId = getNextQuestion(session)!.id;
    const retryQ = session.retryQueue.find((q) => q.id === retryId)!;
    session = gradeAnswer(session, retryId, correctAnswerFor(retryQ))!.session;
    const result = finishSession(session)!;
    expect(result.perfect).toBe(false);
    const attempts = session.stats.correct + session.stats.wrong;
    expect(result.accuracy).toBeCloseTo(session.stats.correct / attempts, 5);
    // XP: semua benar (pertama salah jadi tidak perfect): correct×3 + 2 (tanpa bonus 5)
    expect(result.xpEarned).toBe(session.stats.correct * 3 + 2);
  });

  it("hint dipakai → XP per jawaban itu 3−1=2, bukan 3", () => {
    const session0 = startSession(1, 0, OPTS);
    const q = findQuestion(session0, "T1") ?? findQuestion(session0, "T3") ?? findQuestion(session0, "T4");
    const hinted = requestHint(session0, q!.id, 0)!.session;
    const done = answerAllMainCorrectly(hinted);
    const result = finishSession(done)!;
    const expected = (done.stats.correct - 1) * 3 + 2 + 5 + 2;
    expect(result.xpEarned).toBe(expected);
    expect(result.perfect).toBe(true); // hint bukan salah
  });
});

describe("kontrak generator↔engine", () => {
  it("soal dari generateLessonQuestions langsung bisa dipakai startSession", () => {
    const questions = generateLessonQuestions(112, 0, { dayWib: "2026-10-02" });
    const session: LessonSession = {
      surahId: 112,
      unitIndex: 0,
      questions,
      retryQueue: [],
      answeredIds: [],
      retryDoneIds: [],
      hintUsedIds: [],
      retriedIds: [],
      stats: { correct: 0, wrong: 0, hintsUsed: 0 },
      events: [],
      dayWib: "2026-10-02",
    };
    expect(getNextQuestion(session)?.id).toBe("q1");
  });
});
