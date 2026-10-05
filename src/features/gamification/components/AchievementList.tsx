/**
 * Owner: features/gamification/components. Daftar achievement untuk layar Profil —
 * ONLY layar yang menampilkan status terkunci/terbuka (AC PRD § 5.5).
 *
 * Sumber kebenaran status TIDAK boleh `unlocked` dari store saja: streak bisa
 * turun, jadi achievement yang sudah terbuka tetap harus tampil centang. Karena
 * itu status dihitung ulang dari statistik saat ini (achievementProgress), sama
 * seperti evaluasi unlock. Statistik streak & jumlah surat dibaca langsung dari
 * store pemiliknya masing-masing.
 */
import { useMemo } from "react";
import { Text, View } from "react-native";
import { useT } from "@/core/i18n/hooks";

import { useProgressEventsStore } from "@/core/progress/lesson-store";
import { useReadingStore } from "@/core/progress/reading";
import { AchievementRow } from "@/ui/components";

import { useAchievementStore } from "../achievement-store";
import {
  ACHIEVEMENTS,
  achievementProgress,
  formatAchievementXp,
  type AchievementStats,
} from "../achievements";

export function AchievementList() {
  const { t } = useT();
  const stats = useAchievementStore((s) => s.stats);
  const streakCount = useProgressEventsStore((s) => s.streakCount);
  const openedSurahCount = useReadingStore((s) => s.openedSurahIds.length);

  const rows = useMemo(() => {
    const aggregate: AchievementStats = {
      lessonsCompleted: stats.lessonsCompleted,
      correctT4: stats.correctT4,
      perfectLessons: stats.perfectLessons,
      dzikirTotal: stats.dzikirTotal,
      streakCount,
      openedSurahCount,
    };
    return ACHIEVEMENTS.map((def) => {
      const progress = achievementProgress(aggregate, def);
      return { def, value: progress.value, goal: progress.goal, fraction: progress.fraction, unlocked: progress.unlocked };
    });
  }, [stats, streakCount, openedSurahCount]);

  const opened = rows.filter((row) => row.unlocked).length;

  return (
    <View className="gap-2">
      <Text className="text-ink-secondary text-xs text-center">
        {opened} dari {rows.length} terbuka — sisanya tinggal dikejar 🔥
      </Text>
      {rows.map((row) => (
        <AchievementRow
          key={row.def.id}
          emoji={row.def.emoji}
          title={row.def.title}
          description={t(row.def.descriptionKey)}
          value={row.value}
          goal={row.goal}
          fraction={row.fraction}
          unlocked={row.unlocked}
          reward={formatAchievementXp(row.def.id)}
        />
      ))}
    </View>
  );
}