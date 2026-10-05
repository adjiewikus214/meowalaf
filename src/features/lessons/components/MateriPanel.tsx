/**
 * Owner: features/lessons/components. Fase materi (PRD § 5.4): ayat unit tampil
 * + terjemahan + audio yang wajib diputar minimal 1× sebelum latihan (tombol
 * "Mulai latihan" terkunci + opsi putar ulang). Audio gagal → kunci dibuka
 * (fail-soft, hook).
 */
import { Pressable, Text, View } from "react-native";

import { surahAyahs } from "@/core/content/ayah-source";
import { getSurahMeta } from "@/core/content/meta";
import { useT } from "@/core/i18n/hooks";
import { ARAB_FONT_SIZES } from "@/ui/tokens";
import { Button, TransliteratedText } from "@/ui/components";

export type MateriPanelProps = {
  surahId: number;
  startAyah: number;
  endAyah: number;
  /** Audio sudah sempat diputar → tombol latihan terbuka. */
  unlocked: boolean;
  onPlayAyah: (ayahNumber: number) => void;
  onStart: () => void;
};

export function MateriPanel({ surahId, startAyah, endAyah, unlocked, onPlayAyah, onStart }: MateriPanelProps) {
  const { t } = useT();
  const meta = getSurahMeta(surahId);
  // Ayat datang dari registry (lihat core/content/ayah-source.ts): panel ini tidak
  // boleh meng-import modul teks 2,6 MB, dan layar dijamin sudah mengecek
  // isQuranTextReady() sebelum merender.
  const ayahs = surahAyahs(surahId).filter((a) => a.ayahNumber >= startAyah && a.ayahNumber <= endAyah);

  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text className="text-ink-secondary text-xs uppercase tracking-widest font-sans-semibold">
          {t("lesson.materiLabel", {
            surah: meta?.nameLatin ?? "",
            start: startAyah,
            end: endAyah,
          })}
        </Text>
        <Text className="text-ink-primary font-display text-xl">{t("lesson.materiTitle")}</Text>
        <Text className="text-ink-secondary text-sm">
          {unlocked ? t("lesson.materiUnlocked") : t("lesson.materiLocked")}
        </Text>
      </View>

      <View className="gap-3">
        {ayahs.map((ayah) => (
          <View key={ayah.ayahNumber} className="bg-bg-elevated border border-line rounded-card p-5 gap-3">
            <View className="flex-row items-center justify-between">
              <View className="bg-brand-emerald/15 rounded-full px-3 py-1">
                <Text className="text-brand-emerald text-xs font-sans-semibold">{ayah.ayahNumber}</Text>
              </View>
              <Pressable
                testID={`lesson-audio-${ayah.ayahNumber}`}
                accessibilityRole="button"
                accessibilityLabel={`Putar audio ayat ${ayah.ayahNumber}`}
                hitSlop={12}
                onPress={() => onPlayAyah(ayah.ayahNumber)}
                className="w-11 h-11 items-center justify-center rounded-full bg-white/5 active:opacity-80"
              >
                <Text className="text-base">🔊</Text>
              </Pressable>
            </View>
            <Text
              style={{
                fontSize: ARAB_FONT_SIZES.M,
                lineHeight: ARAB_FONT_SIZES.M * 1.9,
                writingDirection: "rtl",
              }}
              className="font-arab text-ink-arab text-right"
            >
              {ayah.arabic}
            </Text>
            <TransliteratedText className="text-ink-secondary text-sm leading-6" text={ayah.translation} />
          </View>
        ))}
      </View>

      <Button
        testID="lesson-start-practice"
        label={unlocked ? t("lesson.startPractice") : t("lesson.playAudioFirst")}
        onPress={onStart}
        disabled={!unlocked}
      />
      {!unlocked ? (
        <Text testID="lesson-audio-hint" className="text-ink-secondary text-xs text-center">
          {t("lesson.materiLockedHint")}
        </Text>
      ) : null}
    </View>
  );
}