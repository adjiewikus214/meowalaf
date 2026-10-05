/**
 * Binding domain lesson → aturan XP (ARCHITECTURE.md § 3). Logika murni ada di
 * core/progress/xp (data-only); file ini mengikat event domain ke bentuk generik
 * agar app/features tetap punya satu titik import yang nyaman.
 */
export {
  XP_PER_CORRECT_ANSWER,
  XP_HINT_PENALTY,
  XP_MIN_PER_CORRECT,
  XP_PERFECT_BONUS,
  XP_LESSON_COMPLETED,
  XP_LEVEL_BASE,
  xpPerCorrectAnswer,
  xpForEvents,
  bonusXpId,
  xpToReachLevel,
  levelForXp,
  levelProgress,
  type LevelProgress,
} from "@/core/progress/xp";
