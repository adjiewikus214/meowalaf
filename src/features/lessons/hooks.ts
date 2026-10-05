/**
 * Owner: features/lessons. Orkestrasi layar lesson — hubungkan view-state PURE
 * (session.ts) dengan audio, haptic, dan store progres (ARCHITECTURE.md § 1.2:
 * screen memanggil hooks; hooks memanggil engine + repo). Tidak ada aturan
 * belajar baru di sini — semuanya delegasi ke modul pure agar mudah diuji.
 *
 * Semantik penting:
 * - Materi terkunci sampai audio diputar 1× (PRD § 5.4 AC); audio ngambek →
 *   kunci dibuka (fail-soft) dan T4 dibuang dari sesi (degradasi elegan, PRD § 5.4).
 * - Sesi selesai dicatat ATOMIK ke store sekali saja (effect guard) — kill-app
 *   di tengah lesson tidak pernah menghasilkan catatan separuh (ROADMAP § 3).
 * - Audio soal T4 diputar otomatis saat soal muncul; putar ulang bisa manual.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";

import { getSurahMeta } from "@/core/content/meta";
import {
  ensureQuranText,
  getQuranTextStatus,
  isQuranTextReady,
  retryQuranText,
  type QuranTextStatus,
} from "@/core/content/text-module";
import { useLessonPositionStore } from "@/core/progress/lesson-position";
import { useProgressEventsStore } from "@/core/progress/lesson-store";
import { useProfileStore } from "@/core/progress/store";
import { todayWib } from "@/core/time/wib";
import type { SaveOutcome } from "@/core/db/progress-repo";
import { useAchievementStore } from "@/features/gamification/achievement-store";
import { useQuestStore } from "@/features/gamification/quest-store";
import { getAudioController } from "@/features/mushaf/audio/AudioController";
import { useAudio } from "@/features/mushaf/audio/hooks";

import {
  advance,
  applyHint,
  beginPractice,
  canUseHint,
  chooseOption,
  createLessonView,
  currentAnswer,
  markMateriHeard,
  placeChunk as placeSessionChunk,
  removeChunkAt,
  restartLesson,
  submitAnswer,
  type LessonView,
} from "./session";
import { getNextUnitIndex, getLessonUnit } from "./units";
import type { CreateLessonOptions } from "./session";

/** Umpan balik getar halus (native saja — web no-op, ARCHITECTURE.md § 7). */
async function buzz(kind: "correct" | "wrong" | "tap"): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const haptics = await import("expo-haptics");
    if (kind === "tap") {
      await haptics.selectionAsync();
    } else {
      await haptics.impactAsync(
        kind === "correct" ? haptics.ImpactFeedbackStyle.Medium : haptics.ImpactFeedbackStyle.Light,
      );
    }
  } catch {
    // haptic gagal = tidak fatal (fail-soft)
  }
}

export type LessonProgress = {
  surahId: number;
  unitIndex: number;
  totalUnits: number;
  startAyah: number;
  endAyah: number;
};

export type UseLessonSession = {
  /** null bila unit tidak ada / startSession gagal — screen tampilkan not-found. */
  view: LessonView | null;
  /**
   * Teks Quran belum dimuat / gagal dimuat. Sesi TIDAK dibuat sebelum teks siap
   * (generator butuh ayat untuk membuat soal) — layar menampilkan status memuat,
   * bukan layar kosong yang terlihat seperti "surah tidak ada ayat".
   */
  textStatus: QuranTextStatus;
  /** Praktis: layar cukup ganti tampilan kalau `!textReady`. */
  textReady: boolean;
  /** Coba muat ulang teks setelah gagal (tombol "Coba lagi"). */
  retryText: () => void;
  /** Materi: audio sudah sempat diputar (atau audio ngambek → fail-soft). */
  materiUnlocked: boolean;
  /** Audio gagal dimuat → soal T4 dibuang dari sesi (PRD § 5.4). */
  audioUnavailable: boolean;
  /** Progress bar posisi soal. */
  progress: number;
  /** True saat soal pilihan/T2 sudah dijawab lengkap → tombol Cek aktif. */
  canSubmit: boolean;
  /** Setelah dicek: tombol Lanjut muncul. */
  isChecking: boolean;
  canUseHint: boolean;
  /** Hasil sesi (setelah fase hasil). */
  xpEarned: number | null;
  /** Outcome pencatatan store (null = belum selesai / belum dikirim). */
  outcome: SaveOutcome | null;
  // Aksi layar
  startPractice: () => void;
  selectOption: (index: number) => void;
  placeChunk: (displayIndex: number) => void;
  removeChunk: (position: number) => void;
  submit: () => void;
  next: () => void;
  hint: () => void;
  playAyah: (ayahNumber: number) => void;
  restart: () => void;
};

/**
 * Hook utama layar lesson. `surahId`/`unitIndex` dari route; unit tak valid →
 * `view` null (screen menampilkan pesan + tombol kembali).
 */
export function useLessonSession(surahId: number, unitIndex: number): UseLessonSession {
  const reciterId = useProfileStore((s) => s.reciterId);
  const dailyTarget = useProfileStore((s) => s.dailyTarget);
  const freezeEnabled = useProfileStore((s) => s.freezeEnabled);
  const audio = useAudio();

  const dayWib = useMemo(() => todayWib(), []);
  // Opsi generator dibuat per sesi; dipakai ulang saat restart degradasi.
  const baseOptions: CreateLessonOptions = useMemo(
    () => ({ surahId, unitIndex, dayWib, reciterId, includeListenQuestions: true }),
    [surahId, unitIndex, dayWib, reciterId],
  );

  const [view, setView] = useState<LessonView | null>(null);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const recordedRef = useRef(false);
  const degradedRef = useRef(false);

  // -------------------------------------------------------------
  // Teks Quran (chunk 2,6 MB) dimuat terpisah dari bundle startup. Sesi tidak
  // boleh dibuat sebelum teks siap: generator butuh ayat untuk menyusun soal,
  // dan membuat soal dari array kosong akan menghasilkan lesson yang diam-diam
  // tidak punya soal (RULES § 7.3).
  const [textStatus, setTextStatus] = useState<QuranTextStatus>(() =>
    isQuranTextReady() ? "ready" : getQuranTextStatus(),
  );
  const textReady = textStatus === "ready";

  useEffect(() => {
    if (isQuranTextReady()) return;
    let alive = true;
    void ensureQuranText().then(() => {
      if (alive) setTextStatus(getQuranTextStatus());
    });
    return () => {
      alive = false;
    };
  }, []);

  const retryText = useCallback(() => {
    setTextStatus("idle");
    void retryQuranText().then(() => setTextStatus(getQuranTextStatus()));
  }, []);

  // Ganti route (unit berbeda) → sesi baru; efek di StrictMode boleh jalan 2×,
  // createLessonView deterministik jadi hasilnya identik.
  useEffect(() => {
    if (!textReady) return;
    recordedRef.current = false;
    degradedRef.current = false;
    setOutcome(null);
    try {
      setView(createLessonView(baseOptions));
    } catch {
      setView(null); // unit tak ada → screen tampilkan not-found
    }
  }, [baseOptions, textReady]);

  // ---------------------------------------------------------------
  // Audio: degradasi elegan — audio ngambek → buka kunci materi & buang T4.
  // ---------------------------------------------------------------
  const audioUnavailable = audio.status === "unavailable";

  useEffect(() => {
    if (!audioUnavailable || view === null || degradedRef.current) return;
    degradedRef.current = true;
    // Materi tetap terbuka (PRD: wajib dengar 1×; bila tak bisa, jangan kunci user).
    setView((current) => {
      if (current === null) return null;
      // T4 dibuang dari sesi; materi tetap tampil (teks ayat selalu ada) tapi
      // langsung terbuka — tak ada audio yang bisa didengar (fail-soft, PRD § 5.4).
      const next = restartLesson(current, { ...baseOptions, includeListenQuestions: false });
      return markMateriHeard(next);
    });
  }, [audioUnavailable, view, baseOptions]);

  // Materi: audio ayat unit ini sempat berjalan → kunci terbuka.
  const unitRange = useMemo(() => {
    const unit = getLessonUnit(surahId, unitIndex);
    return unit === null || unit === undefined ? null : { start: unit.startAyah, end: unit.endAyah };
  }, [surahId, unitIndex]);

  useEffect(() => {
    if (view === null || view.phase !== "materi" || view.materiHeard) return;
    const nowPlaying = audio.nowPlaying;
    if (
      nowPlaying === null ||
      audio.status !== "playing" && audio.status !== "paused" ||
      nowPlaying.surahId !== surahId ||
      unitRange === null ||
      nowPlaying.ayahNumber < unitRange.start ||
      nowPlaying.ayahNumber > unitRange.end
    ) {
      return;
    }
    setView((current) => (current === null ? current : markMateriHeard(current)));
  }, [audio.status, audio.nowPlaying, view, surahId, unitRange]);

  // ---------------------------------------------------------------
  // T4: putar audio otomatis saat soal muncul (stop saat pindah soal/check).
  // ---------------------------------------------------------------
  const t4Question = useMemo(
    () => (view?.question?.kind === "T4" ? view.question : null),
    [view?.question],
  );
  const checked = view?.view?.checked ?? false;

  useEffect(() => {
    if (t4Question === null || checked) return;
    const controller = getAudioController();
    const total = getSurahMeta(t4Question.surahId)?.ayahCount ?? 1;
    void controller.play(t4Question.surahId, t4Question.ayahNumber, total, reciterId, false);
    return () => {
      void controller.stop(); // berhenti saat pindah soal / dicek / keluar layar
    };
  }, [t4Question, checked, reciterId]);

  // ---------------------------------------------------------------
  // Catat sesi selesai ATOMIK (sekali per sesi, PRD § 5.4 / kill-app safety).
  // ---------------------------------------------------------------
  useEffect(() => {
    if (view === null || view.phase !== "hasil" || view.result === null) return;
    if (recordedRef.current) return;
    recordedRef.current = true;
    const result = view.result;
    // Gamification (quest harian + achievement) dihitung SETELAH sesi tercatat,
    // saat streak di store sudah ter-update — evaluasi achievement baca nilai baru.
    const runGamification = () => {
      const correct = result.events.filter((event) => event.type === "ANSWER_CORRECT").length;
      const correctT4 = result.events.filter(
        (event) => event.type === "ANSWER_CORRECT" && event.kind === "T4",
      ).length;
      useQuestStore
        .getState()
        .lessonCompleted(view.session.dayWib, { correct, perfect: result.perfect });
      useAchievementStore.getState().onLessonCompleted({ correctT4, perfect: result.perfect });
    };
    void useProgressEventsStore
      .getState()
      .recordLessonSession({
        result,
        surahId: view.session.surahId,
        unitIndex: view.session.unitIndex,
        day: view.session.dayWib,
        dailyTarget,
        freezeEnabled,
      })
      .then((saved) => {
        setOutcome(saved);
        runGamification();
      })
      .catch((error: unknown) => {
        // recordLessonSession sendiri fail-soft per store; ini jaring pengaman terakhir.
        console.warn("[lesson] gagal catat sesi:", error instanceof Error ? error.message : String(error));
        setOutcome("saved");
        runGamification();
      });
    // Posisi "Lanjut Ngaji" berpindah ke unit berikutnya dalam surah yang sama.
    const next = getNextUnitIndex(view.session.surahId, view.session.unitIndex);
    if (next !== undefined) {
      useLessonPositionStore.getState().setCurrent({ surahId: view.session.surahId, unitIndex: next });
    }
  }, [view, dailyTarget, freezeEnabled]);

  // ---------------------------------------------------------------
  // Aksi layar — semua delegasi ke modul pure.
  // ---------------------------------------------------------------
  const startPractice = useCallback(() => {
    void buzz("tap");
    setView((current) => (current === null ? current : beginPractice(current)));
  }, []);

  const selectOption = useCallback(
    (index: number) => {
      setView((current) => {
        const next = current === null ? current : chooseOption(current, index);
        if (next !== current) void buzz("tap");
        return next;
      });
    },
    [],
  );

  const placeChunk = useCallback((displayIndex: number) => {
    setView((current) => {
      const next = current === null ? current : placeSessionChunk(current, displayIndex);
      if (next !== current) void buzz("tap");
      return next;
    });
  }, []);

  const removeChunk = useCallback((position: number) => {
    setView((current) => (current === null ? current : removeChunkAt(current, position)));
  }, []);

  const submit = useCallback(() => {
    setView((current) => {
      const next = current === null ? current : submitAnswer(current);
      const verdict = next === null ? null : next.view?.verdict ?? null;
      if (verdict !== null && next !== current) {
        void buzz(verdict === "correct" ? "correct" : "wrong");
      }
      return next;
    });
  }, []);

  const next = useCallback(() => {
    setView((current) => (current === null ? current : advance(current)));
  }, []);

  const hint = useCallback(() => {
    setView((current) => (current === null ? current : applyHint(current)));
  }, []);

  const playAyah = useCallback(
    (ayahNumber: number) => {
      const controller = getAudioController();
      const total = getSurahMeta(surahId)?.ayahCount ?? 1;
      void controller.play(surahId, ayahNumber, total, reciterId, false);
    },
    [surahId, reciterId],
  );

  const restart = useCallback(() => {
    recordedRef.current = false;
    degradedRef.current = false;
    setOutcome(null);
    setView(createLessonView({ ...baseOptions, materiRequired: false }));
  }, [baseOptions]);

  const viewRef = view;
  const materiUnlocked = viewRef !== null && (viewRef.materiHeard || audioUnavailable);

  return {
    view: viewRef,
    textStatus,
    textReady,
    retryText,
    materiUnlocked,
    audioUnavailable,
    progress:
      viewRef === null ? 0 : viewRef.phase === "hasil" ? 1 : (viewRef.position - 1) / Math.max(1, viewRef.total),
    canSubmit: viewRef !== null && currentAnswer(viewRef) !== null,
    isChecking: viewRef?.view?.checked === true,
    canUseHint: viewRef !== null && canUseHint(viewRef),
    xpEarned: viewRef?.result?.xpEarned ?? null,
    outcome,
    startPractice,
    selectOption,
    placeChunk,
    removeChunk,
    submit,
    next,
    hint,
    playAyah,
    restart,
  };
}