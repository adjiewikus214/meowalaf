/**
 * Owner: ui/components. Header section bento (DESIGN.md § 4).
 */
import { Text, View } from "react-native";

export function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <View className="flex-row items-center justify-between px-1">
      <Text className="text-ink-secondary text-xs uppercase tracking-widest font-sans-semibold">
        {title}
      </Text>
      {action !== undefined ? <Text className="text-brand-emerald text-xs">{action}</Text> : null}
    </View>
  );
}
