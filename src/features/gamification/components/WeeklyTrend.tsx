/**
 * Owner: features/gamification/components. Kartu "tren 7 hari" di Profil —
 * dua grafik batang dari lesson_log: XP sesi per hari & akurasi per hari.
 *
 * Mapping domain → presentasi ada di sini (bukan di ui/components) supaya
 * MiniBars tetap tidak tahu apa-apa soal XP/akurasi. Sumber data: `weekly` di
 * lesson-store, dihitung sekali di `loadStats` dari `getAllLessons()` yang
 * sudah dipakai untuk statistik — jadi tidak ada query tambahan.
 */
import { Text, View } from "react-native";

import { useProgressEventsStore } from "@/core/progress/lesson-store";
import { useT } from "@/core/i18n/hooks";
import { weekdayShort } from "@/core/i18n";
import { todayWib } from "@/core/time/wib";
import { Card, MiniBars, type MiniBar } from "@/ui/components";

export function WeeklyTrend() {
  const { t, locale } = useT();
  const trend = useProgressEventsStore((s) => s.weekly);
  const today = todayWib();
  const points = trend.points;
  const todayLabel = t("profile.trendToday");

  if (points.length === 0) {
    return (
      <Card className="items-center gap-1 py-6">
        <Text className="text-2xl">📈</Text>
        <Text className="text-ink-secondary text-xs text-center">
          {t("profile.trendEmpty")}
        </Text>
      </Card>
    );
  }

  const xpBars: MiniBar[] = points.map((point) => ({
    key: point.day,
    label: point.day === today ? todayLabel : weekdayShort(locale, point.day),
    value: point.xp,
    emphasis: point.day === today,
    // Hari tanpa sesi → batang redup, sama seperti akurasi: "tidak ada data"
    // tidak boleh tampil seolah-olah user=nol (dan konsisten antar dua grafik).
    muted: point.sessions === 0,
  }));

  const accuracyBars: MiniBar[] = points.map((point) => ({
    key: point.day,
    label: point.day === today ? todayLabel : weekdayShort(locale, point.day),
    // Hari tanpa jawaban → 0 + muted: tampil sebagai "tidak ada data", bukan 0%.
    value: point.accuracy === null ? 0 : Math.round(point.accuracy * 100),
    emphasis: point.day === today,
    muted: point.accuracy === null,
  }));

  const avg = trend.averageAccuracy;

  return (
    <Card className="gap-4">
      <View className="flex-row items-baseline justify-between gap-2">
        <Text className="text-ink-secondary text-[10px] uppercase tracking-widest font-sans-semibold">
          {t("profile.trendXpTitle")}
        </Text>
        <Text className="text-ink-secondary text-[10px]">
          {trend.totalXp} XP · {t("profile.trendActiveDays", { days: trend.activeDays })}
        </Text>
      </View>
      <MiniBars
        bars={xpBars}
        barClassName="bg-brand-emerald"
        accessibilityLabel={t("profile.trendXpAria", { xp: trend.totalXp, days: trend.activeDays })}
      />

      <View className="flex-row items-baseline justify-between gap-2 border-t border-line pt-4">
        <Text className="text-ink-secondary text-[10px] uppercase tracking-widest font-sans-semibold">
          {t("profile.trendAccuracyTitle")}
        </Text>
        <Text className="text-ink-secondary text-[10px]">
          {t("profile.trendAverage", { value: avg === null ? "—" : `${Math.round(avg * 100)}%` })}
        </Text>
      </View>
      <MiniBars
        bars={accuracyBars}
        barClassName="bg-brand-violet"
        formatValue={(value) => (value === 0 ? "" : `${value}%`)}
        accessibilityLabel={
          avg === null
            ? t("profile.trendAccuracyAriaEmpty")
            : t("profile.trendAccuracyAria", { value: Math.round(avg * 100) })
        }
      />
    </Card>
  );
}