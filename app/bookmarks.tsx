/**
 * Daftar "Ayat Favorit" (Fase A feature plan) — ayat yang user tandai sendiri di
 * mushaf, berbeda dari `reading.lastRead` yang hanya mengikuti posisi baca.
 *
 * Teks ayat TIDAK disimpan di tabel bookmark: yang disimpan hanya
 * surah:ayah (lihat migration v3). Ayatnya diambil dari bundle yang sama dengan
 * mushaf, jadi RULES § 7.1 tetap berlaku — teks tidak pernah diedit, dan tidak
 * ada salinan yang bisa menyimpang dari bundle.
 */
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useT } from "@/core/i18n/hooks";
import { getSurahMeta, type AyahContent } from "@/core/content/meta";
import {
  ensureQuranText,
  getQuranTextStatus,
  getReadyQuranText,
  isQuranTextReady,
  type QuranTextStatus,
} from "@/core/content/text-module";
import { useBookmarkStore } from "@/core/progress/bookmark-store";
import { useProfileStore } from "@/core/progress/store";
import { Button, Card, EmptyState } from "@/ui/components";
import { Ionicons } from "@/ui/icons";
import { ARAB_FONT_SIZES, ARAB_LINE_HEIGHT_RATIO, TOUCH_TARGET } from "@/ui/tokens";

export default function Bookmarks() {
  const { t } = useT();
  const router = useRouter();
  const fontScale = useProfileStore((s) => s.arabFontScale);
  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const loaded = useBookmarkStore((s) => s.loaded);
  const toggle = useBookmarkStore((s) => s.toggle);

  const [status, setStatus] = useState<QuranTextStatus>(() =>
    isQuranTextReady() ? "ready" : "idle",
  );
  const [text, setText] = useState<ReadonlyMap<string, AyahContent> | null>(null);

  useEffect(() => {
    if (isQuranTextReady()) {
      setText(collect(getReadyQuranText().getSurahAyahs, bookmarks));
      return;
    }
    let alive = true;
    void ensureQuranText().then((mod) => {
      if (!alive || mod === null) return;
      setStatus(getQuranTextStatus());
      setText(collect(mod.getSurahAyahs, bookmarks));
    });
    return () => {
      alive = false;
    };
  }, [bookmarks]);

  const header = (
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
        <Text className="text-ink-primary font-display text-xl">{t("bookmark.title")}</Text>
        {loaded && bookmarks.length > 0 ? (
          <Text className="text-ink-secondary text-xs">
            {t("bookmark.count", { count: bookmarks.length })}
          </Text>
        ) : null}
      </View>
    </View>
  );

  // Teks belum siap: tampil loading, BUKAN "0 favorit" — daftar kosong karena
  // bundle belum masuk sama sekali bedanya dengan user yang belum menandai apa pun.
  if (text === null && status !== "failed") {
    return (
      <SafeAreaView className="flex-1 bg-bg-base">
        {header}
        <View className="flex-1 items-center justify-center">
          <Text className="text-ink-secondary text-sm">{t("common.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      {header}
      {bookmarks.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <EmptyState
            emoji="📑"
            title={t("bookmark.empty.title")}
            subtitle={t("bookmark.empty.subtitle")}
          />
          <Button
            label={t("common.back")}
            variant="ghost"
            onPress={() => router.back()}
            testID="bookmark-back"
          />
        </View>
      ) : (
        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 32, gap: 12 }}>
          {bookmarks.map((b) => {
            const meta = getSurahMeta(b.surahId);
            const ayah = text?.get(`${b.surahId}:${b.ayahNumber}`);
            return (
              <Card key={`${b.surahId}:${b.ayahNumber}`} className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={`${meta?.nameLatin ?? ""} ${b.ayahNumber}`}
                    onPress={() => router.push(`/surah/${b.surahId}`)}
                    className="flex-row items-center gap-2 flex-1"
                  >
                    <View className="bg-brand-emerald/15 rounded-full px-3 py-1">
                      <Text className="text-brand-emerald text-xs font-sans-semibold">
                        {meta?.nameLatin ?? b.surahId}:{b.ayahNumber}
                      </Text>
                    </View>
                    {meta !== undefined ? (
                      <Text className="font-arab text-ink-arab text-base">{meta.nameArabic}</Text>
                    ) : null}
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("bookmark.remove", { ayah: b.ayahNumber })}
                    onPress={() => void toggle(b.surahId, b.ayahNumber)}
                    hitSlop={12}
                    className="w-11 h-11 items-center justify-center rounded-full bg-white/5"
                  >
                    <Ionicons name="bookmark" size={19} color="#10B981" />
                  </Pressable>
                </View>
                {/* Teks ayat boleh bolong kalau bundle versi ini tidak punya ayat itu
                    (mis. surah dihapus dari sumber). Lebih baik kosong daripada
                    menampilkan teks yang bukan ayat itu. */}
                {ayah !== undefined ? (
                  <>
                    <Text
                      style={{
                        fontSize: ARAB_FONT_SIZES[fontScale],
                        lineHeight: ARAB_FONT_SIZES[fontScale] * ARAB_LINE_HEIGHT_RATIO,
                        writingDirection: "rtl",
                      }}
                      className="font-arab text-ink-arab text-right"
                    >
                      {ayah.arabic}
                    </Text>
                    <Text className="text-ink-secondary text-sm leading-6">{ayah.translation}</Text>
                  </>
                ) : null}
              </Card>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/** Ambil ayat dari bundle per bookmark — indeks sekali jalan, bukan per kartu. */
function collect(
  getSurahAyahs: (surahId: number) => AyahContent[],
  bookmarks: readonly { surahId: number; ayahNumber: number }[],
): ReadonlyMap<string, AyahContent> {
  const map = new Map<string, AyahContent>();
  const surahIds = [...new Set(bookmarks.map((b) => b.surahId))];
  for (const surahId of surahIds) {
    for (const ayah of getSurahAyahs(surahId)) {
      map.set(`${surahId}:${ayah.ayahNumber}`, ayah);
    }
  }
  return map;
}
