/**
 * Owner: ui/components. Skeleton loading (DESIGN.md § 6 — tanpa spinner klasik).
 */
import { View } from "react-native";

export function Skeleton({ className = "" }: { className?: string }) {
  return <View className={`rounded-xl bg-white/5 ${className}`} />;
}

export function SkeletonAyahList({ rows = 3 }: { rows?: number }) {
  return (
    <View className="gap-4">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} className="gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </View>
      ))}
    </View>
  );
}
