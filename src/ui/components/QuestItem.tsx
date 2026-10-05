/**
 * Owner: ui/components. Item quest harian (DESIGN.md § 4: quest list di Home;
 * § 7 komponen inti). Presentasi murni — progres, status selesai, hadiah XP;
 * aturan & state quest hidup di features/gamification (di-import screen).
 */
import { Text, View } from "react-native";

export type QuestItemProps = {
  title: string;
  /** Nilai terkini (pemanggil sudah clamp ke goal lewat questProgress). */
  value: number;
  goal: number;
  done: boolean;
  /** Hadiah XP saat quest selesai. */
  xp: number;
  /**
   * Teks kecil di bawah progress bar — WAJIB diteruskan dari layar yang sudah
   * terlokalisasi, karena ui/ tidak boleh meng-import core/i18n.
   */
  footer: string;
};

export function QuestItem({ title, value, goal, done, xp, footer }: QuestItemProps) {
  const fraction = goal > 0 ? Math.min(1, Math.max(0, value / goal)) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      // Label netral bahasa: ui/ tidak boleh meng-import core/i18n (ARCHITECTURE § 3),
      // jadi angka & centang dipakai apa adanya — reader layar tetap dapat makna.
      accessibilityLabel={`${title} — ${value}/${goal}${done ? " ✓" : ""}`}
      className={`rounded-card border p-3 gap-2 ${
        done ? "bg-success/10 border-success" : "bg-bg-elevated border-line"
      }`}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text
          className={`text-sm font-sans-semibold flex-1 ${done ? "text-success" : "text-ink-primary"}`}
        >
          {done ? `✓ ${title}` : title}
        </Text>
        <View className={`rounded-full px-2 py-0.5 ${done ? "bg-success/15" : "bg-brand-violet/15"}`}>
          <Text className={`text-[10px] font-sans-semibold ${done ? "text-success" : "text-brand-violet"}`}>
            +{xp} XP
          </Text>
        </View>
      </View>
      <View className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <View
          className={`h-full rounded-full ${done ? "bg-success" : "bg-brand-emerald"}`}
          style={{ width: `${Math.round(fraction * 100)}%` }}
        />
      </View>
      <Text className="text-ink-secondary text-[10px]">
        {value}/{goal} · {footer}
      </Text>
    </View>
  );
}
