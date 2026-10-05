/**
 * Owner: ui/components. Badge streak harian (PRD § 5.2) — jejak kaki kucing +
 * angka + label. Presentasi murni; data streak datang dari core/progress
 * (subscribe di screen).
 *
 * Api 🔥 diganti `CatPaw` saat rebrand Meowalaf (BRAND.md § 4): "streak" jadi
 * jejak kaki yang ditinggalkan Abu tiap hari ngaji.
 */
import { Text, View } from "react-native";

import { CatPaw } from "./CatPaw";

export type StreakFlameProps = {
  /** Jumlah hari beruntun (WIB). */
  count: number;
  /**
   * Label kecil di bawah angka — WAJIB diteruskan dari layar yang sudah
   * terlokalisasi. ui/ tidak boleh meng-import core/i18n (ARCHITECTURE § 3),
   * jadi komponen ini tidak boleh punya default berbahasa.
   */
  caption: string;
  compact?: boolean;
  /** Hook harness performa (RULES § 9) — lihat catatan di Button.testID. */
  testID?: string;
};

export function StreakFlame({ count, caption, compact = false, testID }: StreakFlameProps) {
  return (
    <View
      testID={testID}
      className="bg-bg-elevated border border-line rounded-card items-center px-4 py-2"
      accessibilityLabel={`Streak ${count} ${caption}`}
    >
      <View className="flex-row items-center gap-1">
        <CatPaw size={compact ? 13 : 15} tone="flame" />
        <Text className={`font-display text-flame ${compact ? "text-lg" : "text-xl"}`}>{count}</Text>
      </View>
      <Text className="text-ink-secondary text-[10px]">{caption}</Text>
    </View>
  );
}