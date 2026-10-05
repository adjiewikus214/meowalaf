/**
 * Onboarding ≤ 30 detik (PRD § 5.1): pilih target harian → selesai.
 * Skip = default Santai (1 lesson/hari).
 */
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, CatMascot } from "@/ui/components";
import { useT } from "@/core/i18n/hooks";
import { useProfileStore } from "@/core/progress/store";
import type { TranslationKey } from "@/core/i18n";

const TARGET_OPTIONS = [
  { value: 1, labelKey: "onboarding.pace.chill.label", emoji: "🌱", descKey: "onboarding.pace.chill.desc" },
  { value: 2, labelKey: "onboarding.pace.keen.label", emoji: "🔥", descKey: "onboarding.pace.keen.desc" },
  { value: 3, labelKey: "onboarding.pace.allout.label", emoji: "⚡", descKey: "onboarding.pace.allout.desc" },
] as const satisfies readonly {
  value: number;
  labelKey: TranslationKey;
  emoji: string;
  descKey: TranslationKey;
}[];

export default function Onboarding() {
  const router = useRouter();
  const { t } = useT();
  const dailyTarget = useProfileStore((s) => s.dailyTarget);
  const completeOnboarding = useProfileStore((s) => s.completeOnboarding);

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <View className="flex-1 px-6 pt-10 gap-6">
        <View className="gap-2">
          {/* Abu menyambut di hari pertama (BRAND.md § 2): ia berjalan masuk dari
              kiri lalu melambai — sekali saja, dan diam total kalau user memakai
              reduced-motion (lihat CatMascot.tsx). */}
          <CatMascot size={116} mood="happy" pose="wave" entrance="walk" showMoon testID="onboarding-mascot" />
          <Text className="text-brand-emerald font-display text-sm tracking-[0.2em] uppercase">
            {t("common.appName")}
          </Text>
          <Text className="text-ink-primary font-display text-3xl leading-10">
            {t("onboarding.title")}
          </Text>
          <Text className="text-ink-secondary text-base">{t("onboarding.subtitle")}</Text>
        </View>

        <View className="gap-3">
          {TARGET_OPTIONS.map((opt) => {
            const active = dailyTarget === opt.value;
            return (
              <Pressable
                key={opt.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => useProfileStore.setState({ dailyTarget: opt.value })}
                className={`rounded-card border p-4 flex-row items-center gap-3 ${
                  active ? "border-brand-emerald bg-brand-emerald/10" : "border-line bg-white/5"
                }`}
              >
                <Text className="text-2xl">{opt.emoji}</Text>
                <View className="flex-1">
                  <Text className="text-ink-primary font-sans-bold">{t(opt.labelKey)}</Text>
                  <Text className="text-ink-secondary text-sm">{t(opt.descKey)}</Text>
                </View>
                {active ? <Text className="text-brand-emerald text-lg">✓</Text> : null}
              </Pressable>
            );
          })}
        </View>

        <View className="mt-auto gap-3 pb-4">
          <Button
            testID="onboarding-start"
            label={t("onboarding.start")}
            emoji="🕌"
            onPress={() => {
              completeOnboarding(dailyTarget);
              router.replace("/(tabs)");
            }}
          />
          <Button
            testID="onboarding-skip"
            label={t("onboarding.skip")}
            variant="ghost"
            onPress={() => {
              completeOnboarding(1);
              router.replace("/(tabs)");
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
