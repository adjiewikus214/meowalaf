/**
 * Owner: features/gamification. Achievement — 6 definisi v1 (PRD § 5.5) + 2
dzikir (tasbih, Fase A #2) + evaluasi unlock dari statistik (ARCHITECTURE.md
 * § 4.2: "evaluasi dari log, bukan flag tersebar"). PURE & data-only: store di
 * achievement-store.ts yang memanggil fungsi ini dengan statistik agregat
 * (lesson_log / reading_state / streak / total dzikir), lalu menyimpan unlock
 * SEKALI SAJA.
 *
 * Unlock permanen — daftar `unlocked` tidak pernah di-reset oleh evaluasi
 * (AC PRD § 5.5: "Achievement unlock sekali saja"). Statistik streak memakai
 * nilai SAAT evaluasi; begitu terbuka, tersimpan — jadi walau streak nanti
 * reset, achievement tetap milik user.
 */

import type { TranslationKey } from "@/core/i18n";

export type AchievementId =
  | "first-step"
  | "starter-streak"
  | "week-warrior"
  | "juz30-explorer"
  | "sharp-ear"
  | "perfect"
  | "dzikir-starter"
  | "dzikir-marathon";

/** Kunci statistik agregat yang dibaca tiap achievement. */
export type AchievementStatKey =
  | "lessonsCompleted"
  | "streakCount"
  | "openedSurahCount"
  | "correctT4"
  | "perfectLessons"
  /** Total dzikir SEUMUR HIDUP (bukan harian) — pemiliknya achievement-store. */
  | "dzikirTotal";

/** Input evaluasi — gabungan statistik lintas store (lifetime, kecuali streak = saat ini). */
export type AchievementStats = Record<AchievementStatKey, number>;

export type AchievementDef = {
  id: AchievementId;
  /** Nama resmi dari PRD § 5.5 (biar konsisten di profil & toast). */
  title: string;
  /** Deskripsi santai meta-UI (DESIGN.md § 5). */
  /** Kunci i18n; `title` tetap string karena itu nama achievement (proper noun). */
  descriptionKey: TranslationKey;
  emoji: string;
  stat: AchievementStatKey;
  goal: number;
  /**
   * Hadiah XP saat achievement ini terbuka (PRD § 5.5). Satu angka per
   * definisi, bukan turunan dari `goal` — achievement yang lebih berat bisa
   * diberi nilai lebih, dan penyetelannya tetap keputusan produk.
   */
  xp: number;
};

/**
 * Urutan: 6 achievement v1 (PRD § 5.5) lebih dulu supaya daftar Profil tidak
 * berubah urutannya, lalu dua achievement dzikir (Fase A #2 tasbih).
 */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: "first-step",
    title: "First Step",
    descriptionKey: "achievement.first-step.description",
    emoji: "🐣",
    stat: "lessonsCompleted",
    goal: 1,
    xp: 10,
  },
  {
    id: "starter-streak",
    title: "Starter Streak",
    descriptionKey: "achievement.starter-streak.description",
    emoji: "🔥",
    stat: "streakCount",
    goal: 3,
    xp: 25,
  },
  {
    id: "week-warrior",
    title: "Week Warrior",
    descriptionKey: "achievement.week-warrior.description",
    emoji: "🏆",
    stat: "streakCount",
    goal: 7,
    xp: 75,
  },
  {
    id: "juz30-explorer",
    title: "Juz 30 Explorer",
    descriptionKey: "achievement.juz30-explorer.description",
    emoji: "🗺️",
    stat: "openedSurahCount",
    goal: 5,
    xp: 20,
  },
  {
    id: "sharp-ear",
    title: "Sharp Ear",
    descriptionKey: "achievement.sharp-ear.description",
    emoji: "👂",
    stat: "correctT4",
    goal: 10,
    xp: 30,
  },
  {
    id: "perfect",
    title: "Perfect",
    descriptionKey: "achievement.perfect.description",
    emoji: "✨",
    stat: "perfectLessons",
    goal: 1,
    xp: 15,
  },
  {
    // Satu putaran tasbih (33) — gerbang yang sama dengan "first-step":
    // hadiah pertama harus datang cepat supaya kebiasaan dzikir punya awal.
    id: "dzikir-starter",
    title: "Dhikr Starter",
    descriptionKey: "achievement.dzikir-starter.description",
    emoji: "📿",
    stat: "dzikirTotal",
    goal: 33,
    xp: 10,
  },
  {
    id: "dzikir-marathon",
    title: "Dhikr Marathon",
    descriptionKey: "achievement.dzikir-marathon.description",
    emoji: "🌙",
    stat: "dzikirTotal",
    goal: 1000,
    xp: 40,
  },
];

export function getAchievement(id: AchievementId): AchievementDef {
  const found = ACHIEVEMENTS.find((achievement) => achievement.id === id);
  if (found === undefined) throw new Error(`Achievement tak dikenal: ${id}`);
  return found;
}

/** XP yang didapat saat satu achievement terbuka. */
export function achievementXpReward(def: AchievementDef): number {
  return Math.max(0, Math.trunc(def.xp));
}

/** Total XP kalau beberapa achievement terbuka sekaligus (lesson pertama sempurna). */
export function totalAchievementXp(ids: readonly AchievementId[]): number {
  return ids.reduce((sum, id) => sum + achievementXpReward(getAchievement(id)), 0);
}

/**
 * Alasan yang ditulis ke xp_ledger. Per achievement, bukan satu alasan umum,
 * supaya rekap bisa menunjukkan asal XP tanpa menggali log lain.
 */
export function achievementBonusReason(id: AchievementId): string {
  return `achievement:${id}`;
}

/** Label hadiah untuk toast & daftar Profil: "+25 XP". */
export function formatAchievementXp(id: AchievementId): string {
  return `+${achievementXpReward(getAchievement(id))} XP`;
}

/** Nilai statistik terkini untuk satu achievement (untuk tampilan progres). */
export function achievementValue(stats: AchievementStats, def: AchievementDef): number {
  return Math.max(0, stats[def.stat]);
}

export function isAchievementUnlocked(stats: AchievementStats, def: AchievementDef): boolean {
  return achievementValue(stats, def) >= def.goal;
}

/** Baris tampilan satu achievement — siap pakai buat kartu di Profil. */
export type AchievementProgress = {
  /** Nilai statistik terkini (sudah di-clamp ≥ 0). */
  value: number;
  goal: number;
  /** Progres 0..1 — dinormalisasi biar UI tidak perlu clamp lagi. */
  fraction: number;
  unlocked: boolean;
};

/**
 * Progres satu achievement — PURE & dinormalisasi: `fraction` sudah di 0..1
 * (goal selalu ≥ 1 dari definisi, tapi tetap dijaga agar aman kalau goal diubah).
 * `unlocked` dihitung dari statistik SAAT INI, bukan dari daftar unlock —
 * makanya di UI, achievement yang sudah pernah terbuka tetap tampil tercentang
 * walau streak-nya nanti turun.
 */
export function achievementProgress(stats: AchievementStats, def: AchievementDef): AchievementProgress {
  const value = achievementValue(stats, def);
  const fraction = def.goal > 0 ? Math.min(1, Math.max(0, value / def.goal)) : 0;
  return { value, goal: def.goal, fraction, unlocked: value >= def.goal };
}

/**
 * Achievement yang BARU terbuka dari `stats`, mengabaikan yang sudah ada di
 * `unlocked` (unlock-once, AC PRD § 5.5). Urutan = urutan ACHIEVEMENTS.
 */
export function evaluateAchievements(
  stats: AchievementStats,
  unlocked: readonly AchievementId[],
): AchievementId[] {
  return ACHIEVEMENTS.filter((def) => !unlocked.includes(def.id) && isAchievementUnlocked(stats, def)).map(
    (def) => def.id,
  );
}
