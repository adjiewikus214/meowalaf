import { describe, expect, it } from "vitest";

import {
  advance,
  applyHint,
  beginPractice,
  canUseHint,
  chooseOption,
  createLessonView,
  currentAnswer,
  isAnswerComplete,
  markMateriHeard,
  placeChunk,
  progressFraction,
  removeChunkAt,
  restartLesson,
  submitAnswer,
  totalQuestions,
  type LessonView,
} from "./session";
import type { Question, QuestionKind } from "./types";

const DAY = "2026-10-01" as const;
const SURAH = 1; // Al-Fatihah, 7 ayat → 1 unit
const UNIT = 0;

function create(overrides: Partial<Parameters<typeof createLessonView>[0]> = {}): LessonView {
  return createLessonView({ surahId: SURAH, unitIndex: UNIT, dayWib: DAY, ...overrides });
}

function correctAnswerFor(question: Question): { type: "choice"; index: number } | { type: "order"; order: readonly number[] } {
  if (question.kind === "T2") return { type: "order", order: [...question.correctOrder] };
  return { type: "choice", index: question.correctIndex };
}

/** Jawab soal berjalan dengan benar sampai soal bertipe `kind` muncul. */
function advanceToKind(view: LessonView, kind: QuestionKind): LessonView {
  let current = view;
  for (let guard = 0; guard < 12; guard++) {
    if (current.question === null) throw new Error(`soal ${kind} tidak muncul di sesi`);
    if (current.question.kind === kind) return current;
    const answered = submitAnswerWith(current, correctAnswerFor(current.question));
    current = advance(answered);
  }
  throw new Error(`soal ${kind} tidak muncul dalam 12 langkah`);
}

/** Pilih/letakkan jawaban benar lalu cek — helper untuk Advance yang benar. */
function submitAnswerWith(view: LessonView, answer: { type: "choice"; index: number } | { type: "order"; order: readonly number[] }): LessonView {
  let current = view;
  if (answer.type === "choice") {
    current = chooseOption(current, answer.index);
  } else {
    for (const displayIndex of answer.order) {
      current = placeChunk(current, displayIndex);
    }
  }
  expect(isAnswerComplete(current)).toBe(true);
  return submitAnswer(current);
}

function wrongChoiceIndex(view: LessonView): number {
  const question = view.question;
  if (question === null || question.kind === "T2") throw new Error("bukan soal pilihan");
  const wrong = question.options.findIndex((_, i) => i !== question.correctIndex);
  expect(wrong).toBeGreaterThanOrEqual(0);
  return wrong;
}

describe("createLessonView", () => {
  it("default: fase materi, belum ada soal tampil", () => {
    const view = create();
    expect(view.phase).toBe("materi");
    expect(view.materiHeard).toBe(false);
    expect(view.question).toBeNull();
    expect(view.view).toBeNull();
    expect(view.result).toBeNull();
    expect(view.total).toBe(totalQuestions(view.session));
    expect(view.total).toBeGreaterThanOrEqual(4);
  });

  it("materiRequired=false: langsung fase latihan dengan soal pertama", () => {
    const view = create({ materiRequired: false });
    expect(view.phase).toBe("latihan");
    expect(view.question).not.toBeNull();
    expect(view.view?.kind).toBe(view.question?.kind === "T2" ? "order" : "choice");
    expect(view.view?.checked).toBe(false);
  });

  it("unit tidak valid → throw (fail fast)", () => {
    expect(() => create({ unitIndex: 99 })).toThrow();
  });
});

describe("fase materi", () => {
  it("markMateriHeard idempotent; beginPractice memindah fase", () => {
    const view = create();
    const heard = markMateriHeard(view);
    expect(heard.materiHeard).toBe(true);
    expect(markMateriHeard(heard)).toBe(heard);

    const practice = beginPractice(heard);
    expect(practice.phase).toBe("latihan");
    expect(practice.question).not.toBeNull();
    // idempoten: tidak bisa masuk dua kali
    expect(beginPractice(practice)).toBe(practice);
  });
});

describe("soal pilihan (T1/T3/T4)", () => {
  it("pilih → cek benar → lanjut ke soal berikutnya", () => {
    const view = create({ materiRequired: false });
    const question = view.question;
    if (question === null || question.kind === "T2") throw new Error("harus soal pilihan");

    const chosen = chooseOption(view, question.correctIndex);
    expect(isAnswerComplete(chosen)).toBe(true);
    expect(currentAnswer(chosen)).toEqual({ type: "choice", index: question.correctIndex });

    const checked = submitAnswer(chosen);
    expect(checked.view?.verdict).toBe("correct");
    expect(checked.view?.feedback).toBeNull();
    expect(checked.session.stats.correct).toBe(1);

    const next = advance(checked);
    expect(next.question?.id).not.toBe(question.id);
    expect(next.position).toBe(2);
    expect(progressFraction(next)).toBeGreaterThan(0);
  });

  it("salah → feedback explain + soal masuk antrean ulang (1×)", () => {
    const view = create({ materiRequired: false });
    const wrongIndex = wrongChoiceIndex(view);
    const checked = submitAnswer(chooseOption(view, wrongIndex));
    expect(checked.view?.verdict).toBe("wrong");
    expect(checked.view?.feedback).toBe(view.question?.explain);
    expect(checked.session.retryQueue.map((q) => q.id)).toEqual([view.question?.id]);
    expect(checked.total).toBe(totalQuestions(checked.session));

    // retry baru muncul setelah SELURUH soal fase utama terjawab (engine).
    let current = checked;
    while (current.view?.isRetry !== true) {
      const question = current.question;
      if (question === null) throw new Error("soal hilang");
      current = advance(submitAnswerWith(current, correctAnswerFor(question)));
    }
    expect(current.question?.id).toBe(view.question?.id);

    // benar di percobaan kedua → selesai; tidak di-queue lagi
    const question = current.question;
    if (question === null || question.kind === "T2") throw new Error("harus soal pilihan");
    const second = submitAnswer(chooseOption(current, question.correctIndex));
    expect(second.session.retryDoneIds).toHaveLength(1);
    expect(second.session.retriedIds).toEqual([question.id]);
  });

  it("opsi terkunci setelah memilih & saat sudah dicek", () => {
    const view = create({ materiRequired: false });
    const question = view.question;
    if (question === null || question.kind === "T2") throw new Error("harus soal pilihan");

    const chosen = chooseOption(view, question.correctIndex);
    const otherIndex = question.correctIndex === 0 ? 1 : 0;
    expect(chooseOption(chosen, otherIndex)).toBe(chosen); // no-op

    const checked = submitAnswer(chosen);
    expect(chooseOption(checked, otherIndex)).toBe(checked); // terkunci
    expect(submitAnswer(checked)).toBe(checked); // tak bisa dicek 2×
    expect(advance(view)).toBe(view); // belum dicek → tak bisa lanjut
  });
});

describe("soal susun ayat (T2)", () => {
  it("potongan satu per satu; duplikat diabaikan; undo menghapus", () => {
    const view = advanceToKind(create({ materiRequired: false }), "T2");
    const question = view.question;
    if (question === null || question.kind !== "T2") throw new Error("harus T2");

    const first = placeChunk(view, question.correctOrder[0]!);
    expect(first.view?.kind === "order" && first.view.placed).toEqual([question.correctOrder[0]]);
    expect(isAnswerComplete(first)).toBe(false); // belum semua potongan
    expect(placeChunk(first, question.correctOrder[0]!)).toBe(first); // no-op duplikat

    const undone = removeChunkAt(first, 0);
    expect(undone.view?.kind === "order" && undone.view.placed).toEqual([]);
    expect(removeChunkAt(first, 5)).toBe(first); // posisi tak ada → no-op
  });

  it("semua bagian benar → cek benar; urutan salah → salah", () => {
    const view = advanceToKind(create({ materiRequired: false }), "T2");
    const question = view.question;
    if (question === null || question.kind !== "T2") throw new Error("harus T2");

    const wrongOrder = [...question.correctOrder].reverse();
    const wrongChecked = submitAnswerWith(view, { type: "order", order: wrongOrder });
    expect(wrongChecked.view?.verdict).toBe("wrong");
    expect(wrongChecked.view?.feedback).toBe(question.explain);

    const rightChecked = submitAnswerWith(view, { type: "order", order: [...question.correctOrder] });
    expect(rightChecked.view?.verdict).toBe("correct");
  });
});

describe("hint (maks 1× per soal)", () => {
  it("soal pilihan: eliminasi satu opsi, bukan jawaban benar", () => {
    const view = create({ materiRequired: false });
    const question = view.question;
    if (question === null || question.kind === "T2") throw new Error("harus soal pilihan");
    expect(canUseHint(view)).toBe(true);

    const hinted = applyHint(view);
    expect(hinted.session.hintUsedIds).toEqual([question.id]);
    expect(hinted.session.stats.hintsUsed).toBe(1);
    expect(hinted.session.events.at(-1)).toEqual({ type: "HINT_USED", questionId: question.id });
    if (hinted.view?.kind !== "choice") throw new Error("view bukan choice");
    expect(hinted.view.eliminatedIndex).not.toBe(question.correctIndex);
    expect(canUseHint(hinted)).toBe(false);
    expect(applyHint(hinted)).toBe(hinted); // hint kedua = no-op

    const chosen = chooseOption(hinted, hinted.view.eliminatedIndex!);
    expect(chosen).toBe(hinted); // opsi tereliminasi tak bisa dipilih
  });

  it("soal T2: potongan benar langsung diletakkan di posisi berikutnya", () => {
    const view = advanceToKind(create({ materiRequired: false }), "T2");
    const question = view.question;
    if (question === null || question.kind !== "T2") throw new Error("harus T2");

    const hinted = applyHint(view);
    if (hinted.view?.kind !== "order") throw new Error("view bukan order");
    expect(hinted.view.placed).toEqual([question.correctOrder[0]]);
    expect(hinted.view.revealedCount).toBe(1);

    const nextHint = applyHint(hinted);
    expect(canUseHint(nextHint)).toBe(false); // tetap 1× per soal
    expect(nextHint).toBe(hinted);

    // hint tetap dihitung walau soal dijawab dengan bantuan
    const checked = submitAnswerWith(hinted, { type: "order", order: [...question.correctOrder] });
    expect(checked.view?.verdict).toBe("correct");
    const event = checked.session.events.find(
      (e) => e.type === "ANSWER_CORRECT" && e.questionId === question.id,
    );
    expect(event).toMatchObject({ withHint: true });
  });

  it("tidak ada hint setelah soal dicek", () => {
    const view = create({ materiRequired: false });
    const question = view.question;
    if (question === null || question.kind === "T2") throw new Error("harus soal pilihan");
    const checked = submitAnswer(chooseOption(view, question.correctIndex));
    expect(canUseHint(checked)).toBe(false);
    expect(applyHint(checked)).toBe(checked);
  });
});

describe("penutupan sesi", () => {
  it("semua benar → hasil: phase hasil, XP, perfect, progress 1", () => {
    let view = create({ materiRequired: false });
    for (let guard = 0; guard < 12 && view.phase === "latihan"; guard++) {
      const question = view.question;
      if (question === null) throw new Error("soal hilang");
      view = advance(submitAnswerWith(view, correctAnswerFor(question)));
    }
    expect(view.phase).toBe("hasil");
    expect(view.result?.perfect).toBe(true);
    expect(view.result?.accuracy).toBe(1);
    expect(view.result?.xpEarned).toBeGreaterThan(0);
    expect(view.result?.events.at(-1)).toMatchObject({ type: "SESSION_COMPLETED" });
    expect(progressFraction(view)).toBe(1);
  });

  it("restart: sesi baru, jawaban lama dibuang", () => {
    const checked = submitAnswerWith(create({ materiRequired: false }), (() => {
      const view = create({ materiRequired: false });
      const question = view.question;
      if (question === null) throw new Error("soal hilang");
      return correctAnswerFor(question);
    })());
    const restarted = restartLesson(checked, { dayWib: DAY });
    expect(restarted.phase).toBe("materi");
    expect(restarted.session.stats).toEqual({ correct: 0, wrong: 0, hintsUsed: 0 });
    expect(restarted.position).toBe(1);
  });

  it("restart tanpa audio: soal T4 dibuang (degradasi elegan)", () => {
    const view = create({ materiRequired: false });
    const restarted = restartLesson(view, { dayWib: DAY, includeListenQuestions: false });
    expect(restarted.session.questions.some((q) => q.kind === "T4")).toBe(false);
    expect(restarted.session.questions.length).toBeGreaterThanOrEqual(4);
  });
});