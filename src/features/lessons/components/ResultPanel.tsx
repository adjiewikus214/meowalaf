/**
 * Owner: features/lessons/components. Layar hasil lesson (PRD § 5.4): XP,
 * akurasi, konfeti ringkas, lalu tombol lanjut (unit berikutnya / ulangi / Home).
 * Angka XP/level/streak datang dari store (sudah ter-update lewat recordLessonSession);
 * komponen ini hanya presentasi + pemilihan langkah berikut.
 *
 * Motion (DESIGN.md § 6): XP counter roll-up + Abu lompat di sini; konfeti =
 * ConfettiOverlay yang dipasang layar lesson (overlay isi-layar, bukan di kartu).
 * Semua reanimated & menghormati reduced-motion (→ langsung nilai akhir / diam).
 *
 * Maskot tampil DI SINI (bukan di kartu materi): hasil lesson adalah
 * meta-experience, bukan bagian dari bacaan ayat (RULES § 7.5, BRAND.md § 6).
 */
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import type { SaveOutcome } from "@/core/db/progress-repo";
import { useT } from "@/core/i18n/hooks";
import { useProgressEventsStore } from "@/core/progress/lesson-store";
import { levelProgress } from "@/core/progress/xp";
import { Button, Card, CatMascot, CatPaw, XPBadge } from "@/ui/components";

import type { LessonView } from "../session";

const XP_ROLL_DURATION = 700; // roll-up XP — jendela 600–1200ms (DESIGN.md § 6)
const JUMP_DURATION = 260; // 2 lompatan Abu ≈ 1040ms, masih dalam jendela § 6
const JUMP_HEIGHT = 12;

export type ResultPanelProps = {
  view: LessonView;
  /** Outcome pencatatan (null = masih proses). */
  outcome: SaveOutcome | null;
  /** Unit berikutnya dalam surah sama; null = sudah unit terakhir. */
  nextUnitIndex: number | null;
  onNext: () => void;
  onRepeat: () => void;
  onHome: () => void;
};

export function ResultPanel({
  view,
  outcome,
  nextUnitIndex,
  onNext,
  onRepeat,
  onHome,
}: ResultPanelProps) {
  const result = view.result;
  const { t } = useT();
  const stats = view.session.stats;
  const xpTotal = useProgressEventsStore((s) => s.xpTotal);
  const streakCount = useProgressEventsStore((s) => s.streakCount);
  const lessonsToday = useProgressEventsStore((s) => s.lessonsToday);
  const level = levelProgress(xpTotal);

  const reduced = useReducedMotion() === true;
  const xpProgress = useSharedValue(0);
  const [shownXp, setShownXp] = useState(0);
  const jump = useSharedValue(0);

  // XP counter roll-up (DESIGN.md § 6) — reduced → langsung nilai akhir.
  useEffect(() => {
    if (result === null) return;
    if (reduced) {
      xpProgress.value = result.xpEarned;
      setShownXp(result.xpEarned);
      return;
    }
    xpProgress.value = withTiming(result.xpEarned, {
      duration: XP_ROLL_DURATION,
      easing: Easing.out(Easing.cubic),
    });
  }, [result, reduced, xpProgress]);

  useAnimatedReaction(
    () => Math.round(xpProgress.value),
    (previous, current) => {
      if (current !== null && previous !== current) runOnJS(setShownXp)(current);
    },
  );

  // Abu lompat 2× saat selesai (DESIGN.md § 1 & § 6); reduced → diam.
  useEffect(() => {
    if (result === null || reduced) return;
    jump.value = withRepeat(
      withSequence(
        withTiming(-JUMP_HEIGHT, { duration: JUMP_DURATION, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: JUMP_DURATION, easing: Easing.in(Easing.quad) }),
      ),
      1,
      false,
    );
  }, [result, reduced, jump]);

  const mascotStyle = useAnimatedStyle(() => ({ transform: [{ translateY: jump.value }] }));

  if (result === null) return null;

  const accuracyPercent = Math.round(result.accuracy * 100);
  const headline = result.perfect
    ? t("result.perfect")
    : stats.wrong <= 2
      ? t("result.good")
      : t("result.ok");

  return (
    <View testID="lesson-result" className="gap-4">
      {/* Abu lompat (DESIGN.md § 1: mascot di hasil lesson; § 6: momen selesai). */}
      <View className="items-center" accessibilityElementsHidden>
        <Animated.View style={mascotStyle}>
          <CatMascot size={104} mood={result.perfect ? "cheer" : "happy"} />
        </Animated.View>
      </View>

      <View className="items-center gap-1">
        <Text className="text-ink-primary font-display text-2xl text-center">{headline}</Text>
        <Text
          className="text-brand-emerald font-display text-4xl"
          accessibilityLabel={`+${result.xpEarned} XP`}
        >
          +{shownXp} XP
        </Text>
        {outcome === "duplicate" ? <Text className="text-ink-secondary text-xs">{t("result.alreadyRecorded")}</Text> : null}
      </View>

      <Card variant="glass" className="gap-4">
        <View className="flex-row justify-between">
          <Stat label={t("result.accuracy")} value={`${accuracyPercent}%`} />
          <Stat label={t("result.correct")} value={`${stats.correct}`} />
          <Stat label={t("result.wrong")} value={`${stats.wrong}`} />
          <Stat label={t("result.hintsUsed")} value={`${stats.hintsUsed}`} />
        </View>

        <View className="flex-row items-center justify-between gap-3">
          <XPBadge
            level={level.level}
            xpInLevel={level.xpInLevel}
            xpLevelSpan={level.xpLevelSpan}
            totalXp={xpTotal}
            compact
          />
          <View className="bg-bg-elevated border border-line rounded-card px-4 py-2 items-center">
            <View className="flex-row items-center gap-1">
              <CatPaw size={14} tone="flame" />
              <Text className="font-display text-flame text-lg">{streakCount}</Text>
            </View>
            <Text className="text-ink-secondary text-[10px]">
              {t("result.streakDays", { count: lessonsToday })}
            </Text>
          </View>
        </View>
      </Card>

      <View className="gap-2">
        {nextUnitIndex !== null ? (
          <Button testID="result-next-unit" label={t("result.nextUnit")} onPress={onNext} />
        ) : null}
        <Button
          label={nextUnitIndex !== null ? t("result.repeatUnit") : t("result.repeatLesson")}
          variant="secondary"
          onPress={onRepeat}
        />
        <Button label={t("result.home")} variant="ghost" onPress={onHome} />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="items-center gap-0.5 flex-1">
      <Text className="text-ink-primary font-display text-lg">{value}</Text>
      <Text className="text-ink-secondary text-[10px] text-center">{label}</Text>
    </View>
  );
}