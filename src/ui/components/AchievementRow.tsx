/**
 * Owner: ui/components. Baris achievement di daftar Profil — state terkunci vs
 * terbuka (DESIGN.md § 4/§ 7). Presentasi murni: caller sudah menghitung nilai,
 * goal, dan fraction (lihat achievementProgress di features/gamification).
 *
 * Terkunci tetap tampil (redup + bar progres) supaya user tahu apa yang belum
 * dicapai; yang terbuka dapat warna token + centang. Bar ALWAYS dirender supaya
 * tinggi kartu stabil saat ada achievement baru yang terbuka.
 */
import { Text, View } from "react-native";

export type AchievementRowProps = {
  emoji: string;
  title: string;
  description: string;
  value: number;
  goal: number;
  /** Progres 0..1 — dari achievementProgress, tidak perlu clamp di sini. */
  fraction: number;
  unlocked: boolean;
  /** Label hadiah mis. "+25 XP" — teks bebas, diformat di luar ui. */
  reward?: string;
};

export function AchievementRow({
  emoji,
  title,
  description,
  value,
  goal,
  fraction,
  unlocked,
  reward,
}: AchievementRowProps) {
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`${title} — ${unlocked ? goal : `${value}/${goal}`}${
        reward === undefined ? "" : `. Hadiah ${reward}`
      }`}
      className={`rounded-card border p-3 gap-2 ${unlocked ? "bg-success/10 border-success" : "bg-bg-elevated border-line"}`}
    >
      <View className="flex-row items-center gap-3">
        <View
          className={`w-10 h-10 rounded-full items-center justify-center ${
            unlocked ? "bg-success/15" : "bg-white/5"
          }`}
        >
          {/* Emoji dikecilkan + redup saat terkunci supaya daftar tetap terbaca. */}
          <Text className={`text-xl ${unlocked ? "" : "opacity-40"}`}>{unlocked ? emoji : "🔒"}</Text>
        </View>
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center justify-between gap-2">
            <Text
              className={`text-sm font-sans-semibold flex-1 ${
                unlocked ? "text-success" : "text-ink-primary"
              }`}
            >
              {title}
            </Text>
            <View className="items-end gap-0.5">
              <Text
                className={`text-[10px] font-sans-semibold ${unlocked ? "text-success" : "text-ink-secondary"}`}
              >
                {unlocked ? "✓ terbuka" : `${value}/${goal}`}
              </Text>
              {reward !== undefined ? (
                <Text className="text-[10px] text-brand-emerald opacity-80">{reward}</Text>
              ) : null}
            </View>
          </View>
          <Text className={`text-ink-secondary text-[11px] ${unlocked ? "" : "opacity-70"}`}>{description}</Text>
        </View>
      </View>
      <View className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <View
          className={`h-full rounded-full ${unlocked ? "bg-success" : "bg-brand-violet"}`}
          style={{ width: `${Math.round(clamped * 100)}%` }}
        />
      </View>
    </View>
  );
}