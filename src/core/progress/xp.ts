/**
 * Owner: core/progress. Aturan XP & kurva level (PRD § 5.5) — PURE & data-only:
 * event direpresentasikan dengan RepoLessonEvent (core/db) sehingga modul core
 * TIDAK meng-import features (aturan arah ARCHITECTURE.md § 3). Binding ke tipe
 * domain lesson ada di features/gamification/xp.ts (re-export tipis).
 */
import type { RepoLessonEvent } from "../db/progress-repo";

/** Jawaban benar +3. */
export const XP_PER_CORRECT_ANSWER = 3;
/** Benar dengan bantuan/hint −1. */
export const XP_HINT_PENALTY = 1;
/** Batas bawah per jawaban benar (min +1). */
export const XP_MIN_PER_CORRECT = 1;
/** Bonus sesi sempurna (semua benar, tanpa salah). */
export const XP_PERFECT_BONUS = 5;
/** Bonus lesson selesai. */
export const XP_LESSON_COMPLETED = 2;
/** Basis kurva level: total XP mencapai level n = 50·n·(n+1)/2. */
export const XP_LEVEL_BASE = 50;

export function xpPerCorrectAnswer(withHint: boolean): number {
  return Math.max(XP_MIN_PER_CORRECT, XP_PER_CORRECT_ANSWER - (withHint ? XP_HINT_PENALTY : 0));
}

/** Total XP dari events sesi/quest — satu-satunya jalan masuk XP (PRD § 5.5). */
export function xpForEvents(events: readonly RepoLessonEvent[]): number {
  let total = 0;
  let hasCorrect = false;
  let hasWrong = false;
  let completed = false;
  for (const event of events) {
    if (event.type === "ANSWER_CORRECT") {
      total += xpPerCorrectAnswer(event.withHint);
      hasCorrect = true;
    } else if (event.type === "ANSWER_WRONG") {
      hasWrong = true;
    } else if (event.type === "SESSION_COMPLETED") {
      total += XP_LESSON_COMPLETED;
      completed = true;
    }
  }
  if (completed && hasCorrect && !hasWrong) total += XP_PERFECT_BONUS;
  return total;
}

/**
 * Id unik untuk satu entri xp_ledger.
 *
 * Timestamp milidetik SAJA tidak cukup: dua achievement yang terbuka bersamaan
 * (lesson pertama sempurna → first-step + perfect) dibayar dalam hitungan
 * milidetik yang sama, jadi `bonus-<iso>` bentrok dan INSERT kedua ditolak
 * SQLite — XP hilang tanpa jejak. Nomor urut per sesi menutup celah itu tanpa
 * perlu crypto atau lib apa pun.
 */
export function bonusXpId(createdAt: string, seq: number): string {
  return `bonus-${createdAt}-${seq}`;
}

/**
 * Total XP kumulatif untuk MENCAPAI level n — level 1 di 50 XP, level 2 di 150,
 * level 3 di 300, dst. (PRD § 5.5). Level 0 = belum mencapai level 1 (XP < 50);
 * UI bebas menampilkannya sebagai "Pemula".
 */
export function xpToReachLevel(level: number): number {
  return (XP_LEVEL_BASE * level * (level + 1)) / 2;
}

export function levelForXp(xp: number): number {
  let level = 0;
  while (xpToReachLevel(level + 1) <= xp) level += 1;
  return level;
}

export type LevelProgress = {
  level: number;
  /** XP yang sudah dikumpulkan di level berjalan. */
  xpInLevel: number;
  /** Total XP yang dibutuhkan untuk naik dari level berjalan. */
  xpLevelSpan: number;
};

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  const levelStart = xpToReachLevel(level);
  const nextStart = xpToReachLevel(level + 1);
  return {
    level,
    xpInLevel: xp - levelStart,
    xpLevelSpan: nextStart - levelStart,
  };
}
