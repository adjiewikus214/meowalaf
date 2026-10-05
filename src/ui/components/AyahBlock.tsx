/**
 * Owner: ui/components. Blok ayat mushaf: Arab (RTL, tak dipecah per kata — RULES § 7.4),
 * terjemahan, nomor ayat, tombol play per ayat (PRD § 5.3).
 */
import { Pressable, Text, View } from "react-native";

import { Ionicons } from "@/ui/icons";
import { ARAB_FONT_SIZES, ARAB_LINE_HEIGHT_RATIO } from "@/ui/tokens";
import type { ArabicFontScale } from "@/ui/tokens";
import { TransliteratedText } from "./TransliteratedText";

export type AyahBlockProps = {
  ayahNumber: number;
  arabic: string;
  translation: string;
  fontScale: ArabicFontScale;
  isPlaying: boolean;
  isLoading: boolean;
  onPlay: () => void;
  /**
   * Tandai favorit ayat. Opsional: mushaf & lesson tidak punya bookmark, jadi
   * komponen ini tetap usable di sana tanpa stub. State & storage TIDAK boleh
   * masuk ke ui/ (boundary ARCHITECTURE § 3) — caller yang memutuskan.
   */
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
};

export function AyahBlock({
  ayahNumber,
  arabic,
  translation,
  fontScale,
  isPlaying,
  isLoading,
  onPlay,
  isBookmarked = false,
  onToggleBookmark,
}: AyahBlockProps) {
  return (
    <View className="bg-bg-elevated border border-line rounded-card p-5 gap-3">
      <View className="flex-row items-center justify-between">
        <View className="bg-brand-emerald/15 rounded-full px-3 py-1">
          <Text className="text-brand-emerald text-xs font-sans-semibold">{ayahNumber}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          {onToggleBookmark !== undefined ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Tandai favorit ayat ${ayahNumber}`}
              accessibilityState={{ selected: isBookmarked }}
              onPress={onToggleBookmark}
              hitSlop={12}
              className="w-11 h-11 items-center justify-center rounded-full bg-white/5"
            >
              <Ionicons
                name={isBookmarked ? "bookmark" : "bookmark-outline"}
                size={19}
                color={isBookmarked ? "#10B981" : "#9CA8A4"}
              />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Putar audio ayat ${ayahNumber}`}
            accessibilityState={{ busy: isLoading, selected: isPlaying }}
            onPress={onPlay}
            hitSlop={12}
            className="w-11 h-11 items-center justify-center rounded-full bg-white/5"
          >
            <Ionicons
              name={isLoading ? "hourglass" : isPlaying ? "pause" : "play"}
              size={20}
              color={isPlaying ? "#10B981" : "#9CA8A4"}
            />
          </Pressable>
        </View>
      </View>
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
      <TransliteratedText className="text-ink-secondary text-sm leading-6" text={translation} />
    </View>
  );
}
