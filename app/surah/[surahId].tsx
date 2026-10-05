/**
 * Detail surat (PRD § 5.3): header bismillah, ayat-ayat, audio per ayat + auto-advance,
 * bookmark "terakhir dibaca" otomatis.
 */
import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AyahBlock, Button, Card, EmptyState } from "@/ui/components";
import { Ionicons } from "@/ui/icons";
import {
  ensureQuranText,
  getQuranTextStatus,
  getReadyQuranText,
  isQuranTextReady,
  retryQuranText,
  type QuranTextStatus,
} from "@/core/content/text-module";
import { getSurahMeta, type AyahContent } from "@/core/content/meta";
import { useT } from "@/core/i18n/hooks";
import { useProfileStore } from "@/core/progress/store";
import { isBookmarked, useBookmarkStore } from "@/core/progress/bookmark-store";
import { useReadingStore } from "@/core/progress/reading";
import { todayWib } from "@/core/time/wib";
import { useAchievementStore } from "@/features/gamification/achievement-store";
import { useQuestStore } from "@/features/gamification/quest-store";
import { useAudio } from "@/features/mushaf/audio/hooks";
import { TOUCH_TARGET } from "@/ui/tokens";

export default function SurahDetail() {
  const { t } = useT();
  const params = useLocalSearchParams<{ surahId: string }>();
  const surahId = Number(params.surahId);
  const router = useRouter();
  const meta = getSurahMeta(surahId);

  // Teks Quran hidup di chunk terpisah (docs/PERF.md): layar ini yang memuatnya
  // kalau prefetch startup belum selesai. Ayat TIDAK boleh dirender sebelum siap.
  const [textStatus, setTextStatus] = useState<QuranTextStatus>(() =>
    isQuranTextReady() ? "ready" : "idle",
  );
  const [ayahs, setAyahs] = useState<AyahContent[]>([]);

  useEffect(() => {
    if (isQuranTextReady()) {
      setAyahs(getReadyQuranText().getSurahAyahs(surahId));
      return;
    }
    let alive = true;
    void ensureQuranText().then((mod) => {
      if (!alive) return;
      setTextStatus(getQuranTextStatus());
      if (mod !== null) setAyahs(mod.getSurahAyahs(surahId));
    });
    return () => {
      alive = false;
    };
  }, [surahId]);

  const fontScale = useProfileStore((s) => s.arabFontScale);
  // Bookmark favorit ayat (Fase A feature plan). Dibaca lewat selector supaya
  // hanya blok ayat yang berubah rerender, bukan seluruh FlatList.
  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const toggleBookmark = useBookmarkStore((s) => s.toggle);
  const markLastRead = useReadingStore((s) => s.markLastRead);
  const markSurahOpened = useReadingStore((s) => s.markSurahOpened);

  const audio = useAudio();

  // Bookmark otomatis saat layar dibuka (PRD § 5.3) + quest "buka surat" &
  // achievement Juz 30 Explorer — semua dedup, aman StrictMode double-run.
  useEffect(() => {
    if (meta !== undefined) {
      markLastRead(surahId, 1);
      markSurahOpened(surahId);
      useQuestStore.getState().surahOpened(todayWib(), surahId);
      useAchievementStore.getState().onSurahOpened();
    }
  }, [markLastRead, markSurahOpened, meta, surahId]);

  if (!isQuranTextReady() && textStatus !== "failed") {
    return (
      <SafeAreaView className="flex-1 bg-bg-base px-4">
        <View className="flex-1 items-center justify-center gap-3">
          <Text className="text-ink-secondary text-sm">{t("surah.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (textStatus === "failed") {
    return (
      <SafeAreaView className="flex-1 bg-bg-base px-4">
        <View className="flex-1 items-center justify-center gap-4">
          <Card variant="glass" className="items-center gap-2 min-w-[280px]">
            <Text className="text-ink-primary font-display text-lg text-center">{t("surah.textFailed")}</Text>
            <Text className="text-ink-secondary text-sm text-center">{t("surah.textFailedHint")}</Text>
            <View className="mt-3 w-full gap-2">
              <Button
                label={t("common.retry")}
                onPress={() => {
                  setTextStatus("idle");
                  void retryQuranText().then(() => {
                    setTextStatus(getQuranTextStatus());
                    if (isQuranTextReady()) setAyahs(getReadyQuranText().getSurahAyahs(surahId));
                  });
                }}
              />
              <Button label={t("surah.backToMushaf")} variant="ghost" onPress={() => router.back()} />
            </View>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  if (meta === undefined || ayahs.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base">
        <Stack.Screen options={{ title: "…" }} />
        <EmptyState
          emoji="🤔"
          title={t("surah.notFound.title")}
          subtitle={t("surah.notFound.subtitle")}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <Stack.Screen options={{ title: meta.nameLatin }} />
      <View className="px-4 pt-2 pb-3 flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={() => router.back()}
          style={{ width: TOUCH_TARGET, height: TOUCH_TARGET }}
          className="items-center justify-center rounded-full bg-white/5"
        >
          <Ionicons name="arrow-back" size={22} color="#F4F7F6" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-ink-primary font-display text-xl">{meta.nameLatin}</Text>
          <Text className="text-ink-secondary text-xs">
            {meta.meaningId} · {t("mushaf.ayahCount", { count: meta.ayahCount })} ·{" "}
            {t(meta.revelation === "mekkah" ? "mushaf.revelation.mekkah" : "mushaf.revelation.madinah")}
          </Text>
        </View>
        <Text className="font-arab text-ink-arab text-2xl">{meta.nameArabic}</Text>
      </View>

      <FlatList
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 32, gap: 12 }}
        data={ayahs}
        keyExtractor={(a) => String(a.ayahNumber)}
        initialNumToRender={6}
        ListHeaderComponent={
          surahId !== 1 && surahId !== 9 ? (
            <View className="items-center py-4">
              <Text
                className="font-arab text-ink-arab"
                style={{ fontSize: 26, lineHeight: 26 * 1.9, writingDirection: "rtl" }}
              >
                بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isPlaying =
            audio.nowPlaying?.surahId === surahId && audio.nowPlaying?.ayahNumber === item.ayahNumber;
          const isLoading = isPlaying && audio.status === "loading";
          const isUnavailable = isPlaying && audio.status === "unavailable";
          return (
            <View>
              <AyahBlock
                ayahNumber={item.ayahNumber}
                arabic={item.arabic}
                translation={item.translation}
                fontScale={fontScale}
                isPlaying={isPlaying && audio.status === "playing"}
                isLoading={isLoading}
                onPlay={() => {
                  if (isUnavailable) return;
                  audio.togglePlay(surahId, item.ayahNumber, meta.ayahCount, true);
                  markLastRead(surahId, item.ayahNumber);
                }}
                isBookmarked={isBookmarked(bookmarks, surahId, item.ayahNumber)}
                onToggleBookmark={() => {
                  void toggleBookmark(surahId, item.ayahNumber);
                }}
              />
              {isUnavailable ? (
                <Text className="text-warn text-xs mt-1 px-1">
                  {t("surah.audioDown")}
                </Text>
              ) : null}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
