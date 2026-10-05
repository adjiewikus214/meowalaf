/**
 * Owner: features/gamification. Daily quest — generator DETERMINISTIS dari
 * hari WIB + seed lokal (ARCHITECTURE.md § 4.2: `quests.ts`, PRD § 5.5): 3 quest
 * identik untuk user & tanggal yang sama, berganti setelah tengah malam WIB.
 * PURE & data-only — tanpa React/storage; store di quest-store.ts hanya
 * membungkus state + imbalan XP.
 *
 * Varian quest NON-GLOS (ADR-005 Langkah 3: "tebak arti kata" ditunda sampai
 * glos per kata berlisensi siap — jangan menaikkan quest itu di sini sebelum
 * `word-gloss-*.json` ada). Hadiah tiap quest +5 XP (PRD § 5.5).
 */

/** Hadiah XP per quest selesai (PRD § 5.5). */
export const QUEST_XP_REWARD = 5;

import type { TranslationKey } from "@/core/i18n";

export type QuestCategory = "lesson" | "correct" | "surah" | "perfect" | "dzikir";

export type DailyQuest = {
  /** Stabil antar hari (dipakai sebagai kunci completedIds). */
  id: string;
  category: QuestCategory;
  /** Copy santai meta-UI (DESIGN.md § 5 — bukan teks ayat). */
  /** Kunci i18n, bukan string siap tampil — core/data tidak boleh tahu bahasa (core/i18n). */
  titleKey: TranslationKey;
  goal: number;
  xpReward: number;
};

/** Statistik SEHARI (WIB) yang jadi input evaluasi quest. */
export type QuestDayStats = {
  lessonsCompleted: number;
  correctAnswers: number;
  /** Surat BERBEDA yang dibuka hari ini (dedup). */
  surahsOpened: number;
  perfectLessons: number;
  /** Total dzikir tasbih hari ini (features/tasbih — sumbernya, bukan quest). */
  dzikirCount: number;
};

type QuestVariant = { id: string; titleKey: TranslationKey; goal: number };

/** Kumpulan varian non-glos per kategori (PRD § 5.5 contoh + varian wajar). */
const QUEST_POOL: Record<QuestCategory, readonly QuestVariant[]> = {
  lesson: [
    { id: "lesson-1", titleKey: "quest.lesson-1", goal: 1 },
    { id: "lesson-2", titleKey: "quest.lesson-2", goal: 2 },
  ],
  correct: [
    { id: "correct-12", titleKey: "quest.correct-12", goal: 12 },
    { id: "correct-25", titleKey: "quest.correct-25", goal: 25 },
  ],
  surah: [
    { id: "surah-1", titleKey: "quest.surah-1", goal: 1 },
    { id: "surah-2", titleKey: "quest.surah-2", goal: 2 },
  ],
  perfect: [{ id: "perfect-1", titleKey: "quest.perfect-1", goal: 1 }],
  // Target dzikir kecil & sedang: 33 = satu putaran tasbih, 100 = target
  // harian bawaan tasbih. Bukan quest "hitung sampai 33 lalu berhenti" —
  // yang dihitung total harian, jadi quest ini selesai di tengah dzikir juga.
  dzikir: [
    { id: "dzikir-33", titleKey: "quest.dzikir-33", goal: 33 },
    { id: "dzikir-100", titleKey: "quest.dzikir-100", goal: 100 },
  ],
};

const CATEGORIES: readonly QuestCategory[] = ["lesson", "correct", "surah", "perfect", "dzikir"];
export const QUESTS_PER_DAY = 3;

/** FNV-1a — hash string kecil yang stabil lintas platform. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** PRNG deterministik mulberry32 — dipakai berurutan untuk pilihan kategori/variant. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 3 quest untuk hari WIB `day` — deterministik: input sama → output identik
 * (AC PRD § 5.5). Kategori dipilih unik (bisa termasuk `perfect`), lalu varian
 * dalam kategori. `seed` = "userId lokal" (v1 selalu "local" — tanpa backend).
 */
export function questsForDay(day: string, seed = "local"): DailyQuest[] {
  const random = mulberry32(fnv1a(`${day}#${seed}`));
  const remaining: QuestCategory[] = [...CATEGORIES];
  const picked: QuestCategory[] = [];
  for (let i = 0; i < QUESTS_PER_DAY && remaining.length > 0; i++) {
    const index = Math.floor(random() * remaining.length);
    const [category] = remaining.splice(index, 1);
    if (category !== undefined) picked.push(category);
  }
  return picked.map((category) => {
    const variants = QUEST_POOL[category];
    const variant = variants[Math.floor(random() * variants.length)];
    const fallback: QuestVariant = { id: category, titleKey: `quest.${category}-1` as TranslationKey, goal: 1 };
    const chosen = variant ?? fallback;
    return {
      id: chosen.id,
      category,
      titleKey: chosen.titleKey,
      goal: chosen.goal,
      xpReward: QUEST_XP_REWARD,
    };
  });
}

/** Nilai statistik untuk satu quest (bisa melebihi goal; pakai `questProgress` untuk tampilan). */
export function questValue(quest: DailyQuest, stats: QuestDayStats): number {
  switch (quest.category) {
    case "lesson":
      return stats.lessonsCompleted;
    case "correct":
      return stats.correctAnswers;
    case "surah":
      return stats.surahsOpened;
    case "perfect":
      return stats.perfectLessons;
    case "dzikir":
      return stats.dzikirCount;
  }
}

/** Progres tampilan 0..goal (di-clamp). */
export function questProgress(quest: DailyQuest, stats: QuestDayStats): number {
  return Math.min(questValue(quest, stats), quest.goal);
}

export function isQuestComplete(quest: DailyQuest, stats: QuestDayStats): boolean {
  return questValue(quest, stats) >= quest.goal;
}

/** Quest yang BARU selesai (belum di `completedIds` tapi targetnya tercapai). */
export function newlyCompletedQuests(
  completedIds: readonly string[],
  quests: readonly DailyQuest[],
  stats: QuestDayStats,
): DailyQuest[] {
  return quests.filter((quest) => !completedIds.includes(quest.id) && isQuestComplete(quest, stats));
}

// ---------------------------------------------------------------------------
// State sehari — helper PURE agar alur rollover/gabung bisa diuji tanpa store.
// ---------------------------------------------------------------------------

export type QuestDayState = {
  /** Hari WIB tempat state ini berlaku; ganti hari → reset (tengah malam WIB). */
  day: string;
  quests: readonly DailyQuest[];
  completedIds: readonly string[];
  /** Surat berbeda yang dibuka hari ini (dedup) — input quest kategori surah. */
  openedSurahIds: readonly number[];
  lessonsCompleted: number;
  correctAnswers: number;
  perfectLessons: number;
  /** Total dzikir hari ini — dimiliki tasbih, quest hanya membacanya. */
  dzikirCount: number;
};

export function initialQuestDay(day: string, seed = "local"): QuestDayState {
  return {
    day,
    quests: questsForDay(day, seed),
    completedIds: [],
    openedSurahIds: [],
    lessonsCompleted: 0,
    correctAnswers: 0,
    perfectLessons: 0,
    dzikirCount: 0,
  };
}

/** Roll ke hari baru bila berbeda; hari sama → state dikembalikan apa adanya (idempoten). */
export function rollQuestDay(state: QuestDayState, day: string, seed = "local"): QuestDayState {
  return state.day === day ? state : initialQuestDay(day, seed);
}

export function questDayStats(state: QuestDayState): QuestDayStats {
  return {
    lessonsCompleted: state.lessonsCompleted,
    correctAnswers: state.correctAnswers,
    surahsOpened: state.openedSurahIds.length,
    perfectLessons: state.perfectLessons,
    dzikirCount: state.dzikirCount,
  };
}

export type QuestApplyResult = {
  state: QuestDayState;
  /** Quest yang baru selesai pada update ini (= kandidat imbalan XP). */
  completed: readonly DailyQuest[];
};

function withNewCompletions(state: QuestDayState): QuestApplyResult {
  const completed = newlyCompletedQuests(state.completedIds, state.quests, questDayStats(state));
  if (completed.length === 0) return { state, completed };
  return {
    state: { ...state, completedIds: [...state.completedIds, ...completed.map((quest) => quest.id)] },
    completed,
  };
}

/** Satu lesson selesai → gulir hari bila perlu, tambah hitung, deteksi quest baru selesai. */
export function applyLessonCompleted(
  state: QuestDayState,
  day: string,
  delta: { correct: number; perfect: boolean },
  seed = "local",
): QuestApplyResult {
  const rolled = rollQuestDay(state, day, seed);
  const next: QuestDayState = {
    ...rolled,
    lessonsCompleted: rolled.lessonsCompleted + 1,
    correctAnswers: rolled.correctAnswers + Math.max(0, delta.correct),
    perfectLessons: rolled.perfectLessons + (delta.perfect ? 1 : 0),
  };
  return withNewCompletions(next);
}

/**
 * Total dzikir hari ini berubah (dari tasbih) → simpan yang TERTINGGI, bukan
 * nilai terakhir: hitungan tasbih pernah lebih tinggi (mis. user reset
 * hitungannya) dan quest tidak boleh mundur hanya karena counter direset.
 */
export function applyDzikir(
  state: QuestDayState,
  day: string,
  total: number,
  seed = "local",
): QuestApplyResult {
  const rolled = rollQuestDay(state, day, seed);
  const next = Math.max(rolled.dzikirCount, Math.max(0, Math.floor(total)));
  if (next === rolled.dzikirCount) return { state: rolled, completed: [] };
  return withNewCompletions({ ...rolled, dzikirCount: next });
}

/** Satu surat dibuka → dedup per hari, tambah hitung, deteksi quest baru selesai. */
export function applySurahOpened(
  state: QuestDayState,
  day: string,
  surahId: number,
  seed = "local",
): QuestApplyResult {
  const rolled = rollQuestDay(state, day, seed);
  if (rolled.openedSurahIds.includes(surahId)) return { state: rolled, completed: [] };
  const next: QuestDayState = { ...rolled, openedSurahIds: [...rolled.openedSurahIds, surahId] };
  return withNewCompletions(next);
}
