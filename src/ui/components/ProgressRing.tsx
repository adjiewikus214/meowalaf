/**
 * Owner: ui/components. ProgressRing harian (PRD § 5.2).
 * SVG murni — jalan di web & native (react-native-svg-style manual pakai react-native-svg jika ada;
 * untuk Phase 1 pakai bar fallback supaya tanpa dep tambahan).
 */
import { View, Text } from "react-native";

export type ProgressRingProps = {
  progress: number; // 0..1
  label: string;
  sublabel?: string;
  /** Hook harness performa (RULES § 9) — lihat catatan di Button.testID. */
  testID?: string;
};

export function ProgressRing({ progress, label, sublabel, testID }: ProgressRingProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  const percent = Math.round(clamped * 100);
  return (
    <View
      testID={testID}
      className="items-center justify-center min-w-[96px] px-2"
      accessibilityLabel={`Progres ${percent}%`}
    >
      <View className="w-24 h-24 rounded-full items-center justify-center border-4 border-white/10 bg-brand-emerald/10">
        <View
          className="absolute rounded-full bg-brand-emerald"
          style={{
            bottom: 0,
            height: `${Math.round(clamped * 100)}%`,
            left: 0,
            opacity: 0.35,
            position: "absolute",
            right: 0,
          }}
        />
        <Text className="text-xl font-display text-ink-primary">{label}</Text>
        {sublabel !== undefined ? <Text className="text-xs text-ink-secondary">{sublabel}</Text> : null}
      </View>
    </View>
  );
}
