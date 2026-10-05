/**
 * Owner: ui/components. EmptyState + maskot Abu (BRAND.md § 2, § 5).
 *
 * Dua mode, dan `emoji` MENANG kalau diisi: emoji untuk empty state yang butuh
 * ikon spesifik (mis. 🔍 pencarian), maskot untuk empty state "manusiawi"
 * (belum ada progres, belum ada bacaan). Tidak ada default berbahasa di sini —
 * judul & subjudul selalu datang dari pemanggil yang sudah terlokalisasi.
 */
import { Text, View } from "react-native";

import { CatMascot, type CatMood } from "./CatMascot";

export type EmptyStateProps = {
  /** Kalau diisi, emoji ini yang tampil — maskot tidak digambar. */
  emoji?: string;
  /** Mood maskot kalau `emoji` tidak diisi (default `sleepy`). */
  mood?: CatMood;
  title: string;
  subtitle?: string;
};

export function EmptyState({ emoji, mood = "sleepy", title, subtitle }: EmptyStateProps) {
  return (
    <View className="items-center gap-2 py-10 px-6" accessibilityRole="text">
      {emoji !== undefined ? (
        <Text className="text-4xl">{emoji}</Text>
      ) : (
        <CatMascot size={84} mood={mood} />
      )}
      <Text className="text-ink-primary font-sans-semibold text-base text-center">{title}</Text>
      {subtitle !== undefined ? (
        <Text className="text-ink-secondary text-sm text-center">{subtitle}</Text>
      ) : null}
    </View>
  );
}
