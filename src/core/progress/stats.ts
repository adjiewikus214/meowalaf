/**
 * Owner: core/progress. Rekap statistik profil dari lesson_log (PRD § 5.6) —
 * PURE & data-only: menerima array LessonRecord (core/db), tanpa I/O, tanpa
 * Date.now (sesi terakhir ditentukan dari completedAt milik record, bukan jam
 * device). Akurasi agregat = benar / (benar + salah) dari events — definisi yang
 * sama dengan engine lesson (termasuk percobaan ulang/retry).
 */
import type { LessonRecord } from "../db/progress-repo";

/** Sesi terakhir yang dicatat — dipakai kartu "sesi terakhir" di Profil. */
export type LastSessionStat = {
  day: string;
  completedAt: string;
  surahId: number;
  unitIndex: number;
  /** Akurasi sesi itu (0..1, dari record). */
  accuracy: number;
  xpEarned: number;
  perfect: boolean;
};

export type LessonStats = {
  /** Jumlah sesi lesson selesai (baris lesson_log). */
  sessions: number;
  /** Total XP sepanjang waktu = XP sesi + XP bonus quest (xp_ledger). */
  totalXp: number;
  correctAnswers: number;
  wrongAnswers: number;
  /** Akurasi agregat 0..1; 0 bila belum ada jawaban tercatat (tanpa NaN). */
  accuracy: number;
  perfectSessions: number;
  /** Sesi dengan completedAt terbesar; null bila belum ada sesi. */
  lastSession: LastSessionStat | null;
};

export function emptyLessonStats(): LessonStats {
  return {
    sessions: 0,
    totalXp: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    accuracy: 0,
    perfectSessions: 0,
    lastSession: null,
  };
}

/**
 * Hitung statistik profil dari lesson_log — satu pass, deterministik.
 * Sesi terakhir = completedAt terbesar; bila seri, record pertama dalam array
 * menang (urutan input dari repo sudah terurut selesai).
 *
 * `bonusXpTotal` dijumlahkan ke totalXp karena hadiah quest adalah XP sungguhan
 * yang user terima (dan kini punya ledger sendiri, xp_ledger) — tanpa itu angka
 * "total" di Profil akan lebih kecil dari yang dilihat user di Home.
 */
export function computeLessonStats(lessons: readonly LessonRecord[], bonusXpTotal = 0): LessonStats {
  if (lessons.length === 0 && bonusXpTotal === 0) return emptyLessonStats();

  let totalXp = 0;
  let correct = 0;
  let wrong = 0;
  let perfect = 0;
  let newest: LessonRecord | null = null;

  for (const lesson of lessons) {
    totalXp += lesson.xpEarned;
    if (lesson.perfect) perfect += 1;
    for (const event of lesson.events) {
      if (event.type === "ANSWER_CORRECT") correct += 1;
      else if (event.type === "ANSWER_WRONG") wrong += 1;
    }
    if (newest === null || lesson.completedAt > newest.completedAt) newest = lesson;
  }
  totalXp += bonusXpTotal;

  const answered = correct + wrong;
  return {
    sessions: lessons.length,
    totalXp,
    correctAnswers: correct,
    wrongAnswers: wrong,
    accuracy: answered === 0 ? 0 : correct / answered,
    perfectSessions: perfect,
    lastSession:
      newest === null
        ? null
        : {
            day: newest.day,
            completedAt: newest.completedAt,
            surahId: newest.surahId,
            unitIndex: newest.unitIndex,
            accuracy: newest.accuracy,
            xpEarned: newest.xpEarned,
            perfect: newest.perfect,
          },
  };
}
