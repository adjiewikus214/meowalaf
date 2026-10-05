/**
 * Owner: core/progress. Tren 7 hari dari lesson_log (grafik Profil, PRD § 5.6).
 * PURE & data-only: menerima LessonRecord[] (core/db) + tanggal anchor WIB,
 * tanpa I/O, tanpa Date.now — jadi sama persis di test & di app.
 *
 * Jendela = 7 hari WIB **berakhiri hari `today`**, urut lama → baru. Hari tanpa
 * lesson tetap dapat ember bernilai 0 (grafik butuh kontinuitas — kalau slot
 * hilang, batang bisa "lompat" dan bikin user salah baca). Lesson di luar jendela
 * diabaikan; ember selalu berukuran tepat.
 *
 * `accuracy` = null (bukan 0) untuk hari tanpa jawaban: 0% adalah klaim "salah
 * semua", sedangkan null berarti "tidak ada data" — dibedakan di UI supaya hari
 * kosong tidak tampil seolah-olah user gagal.
 */
import type { LessonRecord } from "../db/progress-repo";
import { shiftWibDay } from "../time/wib";

/** Panjang jendela grafik (jumlah hari). */
export const WEEKLY_DAYS = 7;

/** Satu hari dalam jendela 7 hari. */
export type WeeklyPoint = {
  /** Hari WIB (YYYY-MM-DD). */
  day: string;
  sessions: number;
  /** XP sesi hari itu (dari xpEarned — sama dengan sumber angka total XP Profil). */
  xp: number;
  correctAnswers: number;
  wrongAnswers: number;
  /** benar/(benar+salah), atau null bila tidak ada jawaban tercatat. */
  accuracy: number | null;
};

export type WeeklyTrend = {
  /** Tepat WEEKLY_DAYS titik, urut lama → baru. */
  points: readonly WeeklyPoint[];
  totalXp: number;
  /** Hari yang punya minimal 1 sesi lesson selesai. */
  activeDays: number;
  /** Rata-rata akurasi harian (hanya hari yang ada jawabannya); null kalau tak ada. */
  averageAccuracy: number | null;
};

/**
 * Label 3 huruf untuk sumbu X TIDAK ada di sini: itu copy, dan copy ikut bahasa.
 * Lihat `weekdayShort(locale, day)` di core/i18n.
 */

type Bucket = { sessions: number; xp: number; correct: number; wrong: number };

function emptyBucket(): Bucket {
  return { sessions: 0, xp: 0, correct: 0, wrong: 0 };
}

/**
 * Kelompokkan lesson_log menjadi jendela 7 hari yang berakhir di `today`.
 * Percobaan ulang ikut terhitung, sama dengan definisi akurasi di stats.ts
 * (belajar/(belajar+salah)).
 */
export function computeWeeklyTrend(lessons: readonly LessonRecord[], today: string): WeeklyTrend {
  const days: string[] = [];
  const buckets = new Map<string, Bucket>();
  for (let offset = WEEKLY_DAYS - 1; offset >= 0; offset -= 1) {
    const day = shiftWibDay(today, -offset);
    days.push(day);
    buckets.set(day, emptyBucket());
  }

  for (const lesson of lessons) {
    const bucket = buckets.get(lesson.day);
    if (bucket === undefined) continue; // di luar jendela → bukan bagian grafik ini
    bucket.sessions += 1;
    bucket.xp += lesson.xpEarned;
    for (const event of lesson.events) {
      if (event.type === "ANSWER_CORRECT") bucket.correct += 1;
      else if (event.type === "ANSWER_WRONG") bucket.wrong += 1;
    }
  }

  const points: WeeklyPoint[] = days.map((day) => {
    const bucket = buckets.get(day) ?? emptyBucket();
    const answered = bucket.correct + bucket.wrong;
    return {
      day,
      sessions: bucket.sessions,
      xp: bucket.xp,
      correctAnswers: bucket.correct,
      wrongAnswers: bucket.wrong,
      accuracy: answered === 0 ? null : bucket.correct / answered,
    };
  });

  const withAnswers = points.filter((point) => point.accuracy !== null);
  const averageAccuracy =
    withAnswers.length === 0
      ? null
      : withAnswers.reduce((sum, point) => sum + (point.accuracy ?? 0), 0) / withAnswers.length;

  return {
    points,
    totalXp: points.reduce((sum, point) => sum + point.xp, 0),
    activeDays: points.filter((point) => point.sessions > 0).length,
    averageAccuracy,
  };
}

export function emptyWeeklyTrend(): WeeklyTrend {
  return { points: [], totalXp: 0, activeDays: 0, averageAccuracy: null };
}