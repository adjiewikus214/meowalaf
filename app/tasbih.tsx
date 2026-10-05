/**
 * Tasbih digital (PRD § 5.5) — hitungan dzikir yang terhubung ke ekonomi yang
 * sudah ada: hadiah XP masuk `xp_ledger` (lewat `addBonusXp`) dan target harian
 * tasbih menaikkan streak yang sama dengan lesson (lewat `reachDailyTarget`,
 * idempoten per hari). Layar ini presentasi tipis: aturan hidup di
 * features/tasbih/tasbih.ts (PURE) dan tasbih-store.ts.
 *
 * Kenapa tombol besar, bukan daftar: tasbih dipakai sambil dzikir — mata tidak
 * selalu melihat layar, jadi sasaran sentuhnya satu lingkaran besar di tengah
 * dengan label aksesibilitas yang menyebut dzikir & progresnya.
 */
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useT } from "@/core/i18n/hooks";
import type { TranslationKey } from "@/core/i18n";
import { useProfileStore } from "@/core/progress/store";
import { useProgressEventsStore } from "@/core/progress/lesson-store";
import { Button, Card, ProgressRing, SectionHeader } from "@/ui/components";
import { Ionicons } from "@/ui/icons";
import { TOUCH_TARGET } from "@/ui/tokens";

import {
  TASBIH_MAX_TARGET,
  TASBIH_MIN_TARGET,
  TASBIH_PRESETS,
  TASBIH_XP_PER_PRESET,
  TASBIH_XP_TARGET,
  getTasbihPreset,
  presetRoundProgress,
  tasbihTotal,
} from "@/features/tasbih/tasbih";
import { useTasbihStore } from "@/features/tasbih/tasbih-store";

/** Target harian yang bisa dipilih user — angka bulat yang lazim, bukan slider. */
const TARGET_OPTIONS = [33, 100, 300] as const;

/** Umpan balik getar halus (native saja — web no-op, pola lessons/hooks.ts). */
async function buzz(kind: "tap" | "reward"): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const haptics = await import("expo-haptics");
    await (kind === "tap" ? haptics.selectionAsync() : haptics.notificationAsync(haptics.NotificationFeedbackType.Success));
  } catch {
    // haptic gagal = tidak fatal (fail-soft)
  }
}

type Feedback = { key: TranslationKey; params?: Record<string, string | number> } | null;

export default function Tasbih() {
  const { t } = useT();
  const router = useRouter();
  const arabFontScale = useProfileStore((s) => s.arabFontScale);
  const streakCount = useProgressEventsStore((s) => s.streakCount);

  const state = useTasbihStore();
  const total = tasbihTotal(state);
  const activePreset = getTasbihPreset(state.activePresetId) ?? TASBIH_PRESETS[0]!;

  // Hari bisa berganti saat layar ini masih terbuka (ditinggal semalaman) —
  // hitungan harus ikut tengah malam WIB, sama seperti quest.
  useEffect(() => {
    useTasbihStore.getState().ensureToday();
  }, []);

  // Pesan hadiah bersifat sementara; dibersihkan supaya tidak menempel terus.
  const [feedback, setFeedback] = useState<Feedback>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  const showFeedback = (next: Feedback) => {
    setFeedback(next);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFeedback(null), 2200);
  };

  const onTap = () => {
    // Baca store segar (bukan `state` dari render): tap beruntun dalam satu
    // frame tidak boleh memakai state basi untuk memutuskan umpan balik.
    const before = useTasbihStore.getState();
    const targetWasPaid = before.targetPaid;
    const { paidPresetId } = before.tap(activePreset);
    const after = useTasbihStore.getState();
    void buzz(paidPresetId === null && !after.targetPaid ? "tap" : "reward");
    if (paidPresetId !== null) {
      showFeedback({
        key: "tasbih.presetDone",
        params: { preset: t(activePreset.labelKey), xp: TASBIH_XP_PER_PRESET },
      });
    } else if (!targetWasPaid && after.targetPaid) {
      showFeedback({ key: "tasbih.targetDone", params: { xp: TASBIH_XP_TARGET } });
    }
    // Tap setelah target aman tidak memberi pesan apa pun: umpan balik tiap tap
    // jadi kebisingan, sementara haptic tetap memberi tahu "tercatat".
  };

  const round = presetRoundProgress(state, activePreset);
  const roundDisplay = round === 0 && (state.counts[activePreset.id] ?? 0) > 0 ? activePreset.goal : round;

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <View className="px-4 pt-2 pb-3 flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={() => router.back()}
          style={{ width: TOUCH_TARGET, height: TOUCH_TARGET }}
          className="items-center justify-center rounded-full bg-white/5"
        >
          <Ionicons name="arrow-back" size={22} color="#F4F7F6" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-ink-primary font-display text-xl">{t("tasbih.title")}</Text>
          <Text className="text-ink-secondary text-xs">{t("tasbih.streak", { count: streakCount })}</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 32, gap: 16 }}>
        <Card variant="glass" className="items-center gap-4">
          <View className="flex-row items-center gap-4">
            <ProgressRing
              testID="tasbih-progress-ring"
              progress={state.target > 0 ? total / state.target : 0}
              label={`${total}/${state.target}`}
              sublabel={t("tasbih.ringSublabel")}
            />
            <View className="flex-1 gap-1">
              <Text className="text-ink-secondary text-xs uppercase tracking-widest font-sans-semibold">
                {t("tasbih.today")}
              </Text>
              <Text className="text-ink-primary font-display text-2xl">
                {t("tasbih.count", { count: total })}
              </Text>
            </View>
          </View>
          {state.targetPaid ? (
            <Text className="text-brand-emerald text-sm font-sans-semibold">{t("tasbih.targetDone", { xp: TASBIH_XP_TARGET })}</Text>
          ) : null}
        </Card>

        <View className="gap-2">
          <SectionHeader title={t("tasbih.presetSection")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {TASBIH_PRESETS.map((preset) => {
              const active = preset.id === activePreset.id;
              const paid = state.paidPresetIds.includes(preset.id);
              return (
                <Pressable
                  key={preset.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t(preset.labelKey)}
                  onPress={() => state.selectPreset(preset.id)}
                  className={`rounded-card border px-4 py-3 items-center gap-1 min-w-[112px] ${
                    active ? "border-brand-emerald bg-brand-emerald/10" : "border-line bg-bg-elevated"
                  }`}
                >
                  <Text className="text-ink-primary text-xs font-sans-semibold">
                    {paid ? "\u2713 " : ""}
                    {t(preset.labelKey)}
                  </Text>
                  <Text
                    className="font-arab text-ink-arab"
                    style={{ fontSize: arabFontScale === "L" ? 22 : 18 }}
                  >
                    {preset.arabic}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View className="items-center gap-4 py-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("tasbih.tapLabel", {
              preset: t(activePreset.labelKey),
              count: roundDisplay,
              goal: activePreset.goal,
            })}
            onPress={onTap}
            testID="tasbih-tap"
            className="w-44 h-44 rounded-full items-center justify-center bg-brand-emerald/15 border-4 border-brand-emerald active:opacity-80"
          >
            <Text className="font-arab text-ink-arab text-2xl" style={{ fontSize: 26 }}>
              {activePreset.arabic}
            </Text>
            <Text className="text-ink-primary font-display text-3xl mt-2">{roundDisplay}</Text>
            <Text className="text-ink-secondary text-xs">
              {t("tasbih.round", { goal: activePreset.goal })}
            </Text>
          </Pressable>
          <Text className="text-ink-secondary text-xs text-center px-6">{t("tasbih.tapHint")}</Text>
          {feedback !== null ? (
            <Text className="text-brand-emerald text-sm font-sans-semibold text-center px-6">
              {t(feedback.key, feedback.params)}
            </Text>
          ) : null}
        </View>

        <View className="gap-2">
          <SectionHeader title={t("tasbih.targetSection")} />
          <Card className="flex-row gap-2">
            {TARGET_OPTIONS.map((option) => {
              const active = state.target === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t("tasbih.targetOption", { count: option })}
                  onPress={() => state.setTarget(option)}
                  className={`flex-1 rounded-xl px-3 py-3 border items-center ${
                    active ? "border-brand-emerald bg-brand-emerald/10" : "border-line bg-white/5"
                  }`}
                >
                  <Text className="text-ink-primary font-sans-semibold">{option}</Text>
                  <Text className="text-ink-secondary text-[10px]">{t("tasbih.perDay")}</Text>
                </Pressable>
              );
            })}
          </Card>
          <Text className="text-ink-secondary text-xs px-1">
            {t("tasbih.targetHint", { min: TASBIH_MIN_TARGET, max: TASBIH_MAX_TARGET })}
          </Text>
        </View>

        <Button
          testID="tasbih-reset"
          label={t("tasbih.reset")}
          variant="secondary"
          onPress={() => {
            state.resetAll();
            showFeedback({ key: "tasbih.resetDone" });
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
