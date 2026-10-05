/**
 * Owner: features/lessons. View-state lesson (fase materi → latihan → hasil,
 * PRD § 5.4) — PURE, tanpa React/storage: setiap transisi mengembalikan state
 * BARU, input tidak pernah dimutasi (ARCHITECTURE.md § 1). engine.ts tetap
 * pemilik aturan belajar; modul ini hanya "bentuk layar": apa yang sedang
 * ditanyakan, apa yang sudah dipilih, hint, dan kapan sesi selesai.
 *
 * Hook React (hooks.ts) membungkus modul ini + audio + pencatatan store; app/
 * hanya memanggil hook. Materi tidak bisa di-skip sebelum audio sempat diputar
 * minimal 1× (PRD § 5.4 AC) — lihat `markMateriHeard`.
 */
import {
  finishSession,
  getNextQuestion,
  gradeAnswer,
  isRetryQuestion,
  requestHint,
  startSession,
  type GradeResult,
  type GradeVerdict,
  type SessionResult,
} from "./engine";
import type { GenerateOptions } from "./generator";
import type { LessonSession, Question, QuestionAnswer } from "./types";

export type LessonPhase = "materi" | "latihan" | "hasil";

/** Tipe soal pilihan (T1/T3/T4). */
export type ChoiceView = {
  kind: "choice";
  selectedIndex: number | null;
  /** Opsi yang dieliminasi hint — tetap tampil redup, tak bisa dipilih. */
  eliminatedIndex: number | null;
};

/** Tipe soal susun ayat (T2): potongan yang sudah diletakkan user (indeks-tampil). */
export type OrderView = {
  kind: "order";
  placed: readonly number[];
  /** Berapa potongan terakhir yang dikasih tahu lewat hint (untuk gaya). */
  revealedCount: number;
};

export type QuestionView = {
  checked: boolean;
  verdict: GradeVerdict | null;
  /** Penjelasan inline saat salah (dari engine). */
  feedback: string | null;
  /** true bila ini percobaan kedua dari retryQueue (engine). */
  isRetry: boolean;
} & (ChoiceView | OrderView);

export type LessonView = {
  phase: LessonPhase;
  /** Materi: audio ayat sudah sempat diputar minimal 1× (PRD § 5.4). */
  materiHeard: boolean;
  session: LessonSession;
  /** Soal yang sedang tampil (null saat fase materi & hasil). */
  question: Question | null;
  view: QuestionView | null;
  /** Posisi soal 1-based dalam sesi (termasuk pengulangan). */
  position: number;
  /** Total soal sesi — bertambah begitu ada soal salah yang masuk retry queue. */
  total: number;
  result: SessionResult | null;
};

export type CreateLessonOptions = {
  surahId: number;
  unitIndex: number;
} & GenerateOptions & {
  /** false = langsung fase latihan (unit diulang / deep-link). Default true. */
  materiRequired?: boolean;
};

/** Jumlah soal sesi saat ini: fase utama + pengulangan yang sudah terjadwal. */
export function totalQuestions(session: LessonSession): number {
  return session.questions.length + session.retryQueue.length;
}

function viewForQuestion(session: LessonSession, question: Question): QuestionView {
  const base = {
    checked: false,
    verdict: null,
    feedback: null,
    isRetry: isRetryQuestion(session, question.id),
  };
  if (question.kind === "T2") {
    return { ...base, kind: "order", placed: [], revealedCount: 0 };
  }
  return { ...base, kind: "choice", selectedIndex: null, eliminatedIndex: null };
}

/**
 * Membuat sesi + view baru. Melempar Error bila surah/unit tidak valid
 * (engine) — pemanggil (hook) yang mengembalikan state error ke layar.
 */
export function createLessonView(options: CreateLessonOptions): LessonView {
  const { surahId, unitIndex, materiRequired = true, ...generateOptions } = options;
  const session = startSession(surahId, unitIndex, generateOptions);
  const phase: LessonPhase = materiRequired ? "materi" : "latihan";
  const question = phase === "latihan" ? getNextQuestion(session) : null;
  return {
    phase,
    materiHeard: false,
    session,
    question,
    view: question === null ? null : viewForQuestion(session, question),
    position: 1,
    total: totalQuestions(session),
    result: null,
  };
}

/** Materi: tandai audio sudah diputar (membuka tombol "Mulai Latihan"). */
export function markMateriHeard(view: LessonView): LessonView {
  if (view.phase !== "materi" || view.materiHeard) return view;
  return { ...view, materiHeard: true };
}

/** Materi → latihan. Nyaman dipanggil ulang setelah option berubah. */
export function beginPractice(view: LessonView): LessonView {
  if (view.phase !== "materi") return view;
  const question = getNextQuestion(view.session);
  if (question === null) return view; // generator selalu ≥ 1 soal; jaga-jaga
  return {
    ...view,
    phase: "latihan",
    question,
    view: viewForQuestion(view.session, question),
  };
}

/** Pilih salah satu opsi (T1/T3/T4). No-op bila sudah memilih / terkunci. */
export function chooseOption(view: LessonView, optionIndex: number): LessonView {
  if (view.phase !== "latihan" || view.view === null || view.view.kind !== "choice") return view;
  if (view.view.checked) return view;
  if (view.view.selectedIndex !== null) return view; // harus cek dulu
  if (optionIndex === view.view.eliminatedIndex) return view;
  return { ...view, view: { ...view.view, selectedIndex: optionIndex } };
}

/**
 * Taruh potongan kata ke posisi berikutnya (T2). `displayIndex` = indeks di
 * `question.chunks` (posisi tampil). Potongan yang sudah diletakkan tidak bisa
 * diletakkan dua kali (no-op) — penghapusan via `removeChunkAt`.
 */
export function placeChunk(view: LessonView, displayIndex: number, viaHint = false): LessonView {
  if (view.phase !== "latihan" || view.view === null || view.view.kind !== "order") return view;
  if (view.view.checked || view.question === null || view.question.kind !== "T2") return view;
  if (view.view.placed.includes(displayIndex)) return view;
  return {
    ...view,
    view: {
      ...view.view,
      placed: [...view.view.placed, displayIndex],
      revealedCount: viaHint ? view.view.revealedCount + 1 : view.view.revealedCount,
    },
  };
}

/** Hapus potongan pada posisi tertentu (undo, T2). */
export function removeChunkAt(view: LessonView, position: number): LessonView {
  if (view.phase !== "latihan" || view.view === null || view.view.kind !== "order") return view;
  if (view.view.checked || position < 0 || position >= view.view.placed.length) return view;
  return { ...view, view: { ...view.view, placed: view.view.placed.slice(0, position) } };
}

/** Jawaban yang akan dinilai, atau null bila belum lengkap. */
export function currentAnswer(view: LessonView): QuestionAnswer | null {
  if (view.question === null || view.view === null) return null;
  if (view.view.kind === "choice") {
    return view.view.selectedIndex === null ? null : { type: "choice", index: view.view.selectedIndex };
  }
  if (view.question.kind !== "T2") return null;
  if (view.view.placed.length !== view.question.chunks.length) return null;
  return { type: "order", order: view.view.placed };
}

export function isAnswerComplete(view: LessonView): boolean {
  return currentAnswer(view) !== null;
}

/** Hint tersedia? Maks 1× per soal, hanya sebelum dicek, dan belum ada pilihan. */
export function canUseHint(view: LessonView): boolean {
  if (view.phase !== "latihan" || view.question === null || view.view === null) return false;
  if (view.view.checked || view.session.hintUsedIds.includes(view.question.id)) return false;
  if (view.view.kind === "choice") return view.view.selectedIndex === null;
  return view.question.kind === "T2" && view.view.placed.length < view.question.chunks.length;
}

/** Opsi yang aman dieliminasi: bukan jawaban benar, bukan yang sedang dipilih. */
function safeElimination(selectedIndex: number | null, correctIndex: number, optionCount: number): number {
  for (let i = 0; i < optionCount; i++) {
    if (i !== correctIndex && i !== selectedIndex) return i;
  }
  return correctIndex;
}

/**
 * Pakai hint (engine yang memutuskan bentuknya): T1/T3/T4 → eliminasi opsi,
 * T2 → potongan benar berikutnya langsung diletakkan di posisinya.
 */
export function applyHint(view: LessonView): LessonView {
  if (view.question === null || view.view === null || !canUseHint(view)) return view;
  const placedCount = view.view.kind === "order" ? view.view.placed.length : 0;
  const hinted = requestHint(view.session, view.question.id, placedCount);
  if (hinted === null) return view;
  const withHintUsed: LessonView = { ...view, session: hinted.session };

  if (hinted.hint.type === "reveal-position") {
    // Hint T2 = meletakkan potongan benar (session sudah ter-update di atas).
    return placeChunk(withHintUsed, hinted.hint.chunkIndex, true);
  }
  if (view.view.kind !== "choice" || view.question === null || view.question.kind === "T2") {
    return withHintUsed;
  }
  return {
    ...withHintUsed,
    view: {
      ...view.view,
      eliminatedIndex: safeElimination(
        view.view.selectedIndex,
        view.question.correctIndex,
        view.question.options.length,
      ),
    },
  };
}

/** Nilai jawaban. No-op (state sama) bila jawaban belum lengkap / sudah dicek. */
export function submitAnswer(view: LessonView): LessonView {
  if (view.phase !== "latihan" || view.question === null || view.view === null || view.view.checked) {
    return view;
  }
  const answer = currentAnswer(view);
  if (answer === null) return view;
  const graded: GradeResult | null = gradeAnswer(view.session, view.question.id, answer);
  if (graded === null) return view;
  return {
    ...view,
    session: graded.session,
    total: totalQuestions(graded.session),
    view: { ...view.view, checked: true, verdict: graded.verdict, feedback: graded.feedback },
  };
}

/** Lanjut setelah dicek: soal berikutnya, atau fase hasil bila sesi tuntas. */
export function advance(view: LessonView): LessonView {
  if (view.phase !== "latihan" || view.view === null || !view.view.checked) return view;
  const question = getNextQuestion(view.session);
  if (question === null) {
    const result = finishSession(view.session);
    if (result === null) return view;
    return {
      ...view,
      phase: "hasil",
      question: null,
      view: null,
      position: totalQuestions(view.session),
      result,
    };
  }
  return {
    ...view,
    question,
    view: viewForQuestion(view.session, question),
    position: view.session.answeredIds.length + view.session.retryDoneIds.length + 1,
    total: totalQuestions(view.session),
  };
}

/**
 * Mulai ulang sesi (mis. setelah audio tak tersedia → T4 dibuang, PRD § 5.4
 * AC "degradasi elegan"). Sesi & jawaban sebelumnya dibuang — belum selesai,
 * jadi tidak pernah tercatat (kill-app safety, lesson-store.ts).
 */
export function restartLesson(
  view: LessonView,
  options: Omit<CreateLessonOptions, "surahId" | "unitIndex">,
): LessonView {
  return createLessonView({
    ...options,
    surahId: view.session.surahId,
    unitIndex: view.session.unitIndex,
  });
}

/** Progres bar 0..1 — naik monoton, dihitung dari soal yang sudah dijawab. */
export function progressFraction(view: LessonView): number {
  if (view.phase === "hasil") return 1;
  if (view.total <= 0) return 0;
  const done = Math.max(0, view.position - 1);
  return Math.min(1, done / view.total);
}