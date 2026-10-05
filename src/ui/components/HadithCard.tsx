/**
 * Owner: ui/components. Kartu "Hadis hari ini" di Home.
 *
 * Komponen ini **sengaja tidak merender maskot** (BRAND.md § 6.1 / RULES § 7.9):
 * Abu boleh muncul di meta-experience, tapi tidak pernah di dalam atau di samping
 * teks suci — hadis adalah teks suci. Aturan itu dijaga test di
 * `features/home/hadith.test.ts`, yang membaca sumber file ini sebagai teks.
 *
 * Teks Arab mengikuti aturan mushaf yang sama dengan `AyahBlock`: RTL, `font-arab`,
 * ukuran mengikuti setelan user, dan **tidak** dipecah per kata (RULES § 7.4).
 * Yang berbeda dari mushaf: hadis tidak punya nomor ayat, jadi tidak ada kapsul
 * nomor dan tidak ada tombol play.
 *
 * Semua copy masuk lewat props, bukan ditulis di dalam JSX — `no-hardcoded-copy`
 * menjaga itu, dan di sini kebetulan berimpit dengan RULES § 7.5.
 */
import { Text, View } from "react-native";

import { ARAB_FONT_SIZES, ARAB_LINE_HEIGHT_RATIO } from "@/ui/tokens";
import type { ArabicFontScale } from "@/ui/tokens";

export type HadithCardProps = {
  arabic: string;
  translation: string;
  attribution: string;
  fontScale: ArabicFontScale;
};

export function HadithCard({ arabic, translation, attribution, fontScale }: HadithCardProps) {
  return (
    <View className="bg-bg-elevated border border-line rounded-card p-5 gap-3">
      <Text
        style={{
          fontSize: ARAB_FONT_SIZES[fontScale],
          lineHeight: ARAB_FONT_SIZES[fontScale] * ARAB_LINE_HEIGHT_RATIO,
          writingDirection: "rtl",
        }}
        className="font-arab text-ink-arab text-right"
      >
        {arabic}
      </Text>
      <View className="border-l-2 border-gold pl-3 gap-1">
        <Text className="text-ink-primary text-sm leading-6">{translation}</Text>
        <Text className="text-ink-secondary text-xs leading-5">{attribution}</Text>
      </View>
    </View>
  );
}