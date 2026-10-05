/**
 * Binding domain lesson → engine streak (ARCHITECTURE.md § 3). Logika murni ada
 * di core/progress/streak (data-only); file ini titik import untuk features/app.
 */
export {
  FREEZE_MAX_GAP_DAYS,
  onDailyTargetReached,
  type StreakState,
  type StreakUpdate,
} from "@/core/progress/streak";
