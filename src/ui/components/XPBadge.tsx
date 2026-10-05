/**
 * Owner: ui/components. Badge level + XP ke level berikutnya (PRD § 5.5).
 * Presentasi murni: caller meng-hitung level dari aturan XP (core/progress/xp).
 */
import { Text, View } from "react-native";

export type XPBadgeProps = {
  /** Level yang sedang erreached (0 = belum level 1). */
  level: number;
  xpInLevel: number;
  xpLevelSpan: number;
  totalXp?: number;
  compact?: boolean;
  /** Hook harness performa (RULES § 9) — lihat catatan di Button.testID. */
  testID?: string;
};

export function XPBadge({
  level,
  xpInLevel,
  xpLevelSpan,
  totalXp,
  compact = false,
  testID,
}: XPBadgeProps) {
  const safeSpan = Math.max(1, xpLevelSpan);
  const fraction = Math.min(1, Math.max(0, xpInLevel / safeSpan));
  return (
    <View
      testID={testID}
      className="bg-bg-elevated border border-line rounded-card px-4 py-2 gap-1 min-w-[104px]"
      accessibilityLabel={`Level ${level}, ${xpInLevel} dari ${safeSpan} XP menuju level berikutnya`}
    >
      <View className="flex-row items-center gap-1">
        <Text className="text-base">⚡</Text>
        <Text className="font-display text-brand-emerald text-base">Level {level}</Text>
      </View>
      <View className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <View className="h-full rounded-full bg-brand-emerald" style={{ width: `${Math.round(fraction * 100)}%` }} />
      </View>
      {!compact ? (
        <Text className="text-ink-secondary text-[10px]">
          {xpInLevel}/{safeSpan} XP
          {totalXp !== undefined ? ` · total ${totalXp}` : ""}
        </Text>
      ) : null}
    </View>
  );
}