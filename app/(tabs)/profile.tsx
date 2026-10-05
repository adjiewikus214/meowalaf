/**
 * Profil & Settings (PRD § 5.7): nama, avatar, qari, ukuran teks Arab,
 * tautan ke layar "Tentang & Sumber Konten" (RULES § 7.6), hapus semua data.
 */
import { useEffect } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatDay } from "@/core/i18n";
import type { Locale, TranslationKey } from "@/core/i18n";
import { useT } from "@/core/i18n/hooks";
import { Card, SectionHeader, Skeleton } from "@/ui/components";
import { Ionicons } from "@/ui/icons";
import { AVATAR_CHOICES, useProfileStore } from "@/core/progress/store";
import { useBookmarkStore } from "@/core/progress/bookmark-store";
import { useTasbihStore } from "@/features/tasbih/tasbih-store";
import { usePrayerLocationStore } from "@/features/prayer/prayer-location-store";
import type { ArabicFontScale } from "@/core/progress/store";
import { isProgressLoading, useHydrationStore } from "@/core/progress/hydration-store";
import { useProgressEventsStore } from "@/core/progress/lesson-store";
import { todayWib } from "@/core/time/wib";
import { getSurahMeta, reciters } from "@/core/content/meta";
import { useAchievementStore } from "@/features/gamification/achievement-store";
import { useQuestStore } from "@/features/gamification/quest-store";
import { AchievementList } from "@/features/gamification/components/AchievementList";
import { WeeklyTrend } from "@/features/gamification/components/WeeklyTrend";
import { ReminderSettings } from "@/features/reminders/ReminderSettings";

/**
 * "Hapus semua data" harus mengosongkan SEMUA sumber progres, bukan cuma profil:
 * SQLite (lesson_log/progress_state) + quest + achievement. Kalau salah satu
 * dilewatkan, progres yang "dihapus" bakal nongol lagi setelah app dibuka ulang.
 */
async function wipeAllProgress(): Promise<void> {
  useQuestStore.getState().resetAll();
  useAchievementStore.getState().resetAll();
  // State memori ikut dikosongkan: repo sudah dihapus, tapi daftar yang masih
  // di RAM akan muncul lagi begitu layar bookmark dibuka (RULES § 8).
  useBookmarkStore.getState().resetAll();
  // Hitungan tasbih juga hidup di AsyncStorage: kalau dilewatkan, angka yang
  // "dihapus" muncul lagi begitu layar tasbih dibuka (RULES § 8).
  useTasbihStore.getState().resetAll();
  // Lokasi salat + preferensi pengingatnya juga persisten (ADR-010): direset di
  // sini supaya "hapus semua data" benar-benar berarti data (RULES § 8).
  usePrayerLocationStore.getState().resetAll();
  await useProgressEventsStore.getState().resetProgress(todayWib());
}

/** Ukuran teks Arab — label diambil dari kamus, jadi ikut bahasa. */
const SCALES: { value: ArabicFontScale }[] = [{ value: "S" }, { value: "M" }, { value: "L" }];

/**
 * Bahasa yang bisa dipilih. Sengaja daftar statis, bukan turunan dari
 * LOCALES: nama bahasa ditulis dalam bahasanya sendiri (bukan "Indonesian" /
 * "English"), jadi kamus yang menyesuaikan labelnya sendiri.
 */
const LANGUAGE_OPTIONS: { value: Locale; labelKey: TranslationKey }[] = [
  { value: "id", labelKey: "profile.language.id" },
  { value: "en", labelKey: "profile.language.en" },
];

/** Angka kecil dalam grid statistik — presentasi murni, tetap di file ini. */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View className="items-center gap-0.5 flex-1">
      <Text className="text-ink-primary font-display text-xl">{value}</Text>
      <Text className="text-ink-secondary text-[10px] uppercase tracking-widest">{label}</Text>
    </View>
  );
}

export default function Profile() {
  const profile = useProfileStore();
  const { t, locale, setLocale } = useT();
  const stats = useProgressEventsStore((state) => state.stats);
  // Rekap, tren, dan achievement semuanya berasal dari SQLite (lesson_log).
  // Sebelum repo siap mereka akan tampil sebagai "belum ada sesi" - itu klaim
  // palsu, jadi diganti placeholder (ADR-009).
  const progressStatus = useProgressEventsStore((state) => state.status);
  const hydrationPhase = useHydrationStore((state) => state.phase);
  const progressLoading = isProgressLoading(hydrationPhase, progressStatus);
  const router = useRouter();

  // Segarkan rekap dari lesson_log tiap layar Profil dibuka (dan tiap sesi selesai
  // store sudah me-refresh sendiri — lihat lesson-store.loadStats).
  useEffect(() => {
    void useProgressEventsStore.getState().loadStats();
  }, []);

  const accuracyPct = Math.round(stats.accuracy * 100);
  const last = stats.lastSession;
  const lastSurah = last === null ? undefined : getSurahMeta(last.surahId);

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8 gap-4">
        <View className="items-center gap-2 pt-4">
          <Text className="text-5xl">{profile.avatar}</Text>
          <Text className="text-ink-primary font-display text-2xl">{profile.displayName}</Text>
          {progressLoading ? (
            <Skeleton className="h-4 w-52" />
          ) : (
            <Text className="text-ink-secondary text-sm">
              {stats.sessions === 0
                ? t("profile.statsEmpty")
                : t("profile.statsSummary", {
                    sessions: stats.sessions,
                    accuracy: accuracyPct,
                    xp: stats.totalXp,
                  })}
            </Text>
          )}
        </View>

        <View className="gap-2 mt-2">
          <SectionHeader title={t("profile.statsSection")} />
          {progressLoading ? (
            <Card className="gap-4">
              <View className="flex-row gap-3">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 flex-1" />
              </View>
              <Skeleton className="h-3 w-full" />
            </Card>
          ) : (
            <Card className="gap-4">
              <View className="flex-row">
                <Stat value={String(stats.totalXp)} label={t("profile.stat.xp")} />
                <Stat value={`${accuracyPct}%`} label={t("profile.stat.accuracy")} />
                <Stat value={String(stats.sessions)} label={t("profile.stat.sessions")} />
                <Stat value={String(stats.perfectSessions)} label={t("profile.stat.perfect")} />
              </View>
              {last === null ? (
                <Text className="text-ink-secondary text-xs text-center">
                  {t("profile.lastSessionNone")}
                </Text>
              ) : (
                <View className="gap-1 border-t border-line pt-3">
                  <Text className="text-ink-secondary text-[10px] uppercase tracking-widest font-sans-semibold">
                    {t("profile.lastSession")}
                  </Text>
                  <Text className="text-ink-primary font-sans-semibold">
                    {t("profile.lastSessionUnit", {
                      surah: lastSurah?.nameLatin ?? `Surat ${last.surahId}`,
                      unit: last.unitIndex + 1,
                    })}
                  </Text>
                  <Text className="text-ink-secondary text-xs">
                    {t("profile.lastSessionLine", {
                      day: formatDay(locale, last.day),
                      accuracy: Math.round(last.accuracy * 100),
                      xp: last.xpEarned,
                    })}
                    {last.perfect ? t("profile.lastSessionPerfect") : ""}
                  </Text>
                </View>
              )}
            </Card>
          )}
        </View>

        <View className="gap-2 mt-2">
          <SectionHeader title={t("profile.trendSection")} />
          {progressLoading ? (
            // WeeklyTrend menampilkan "grafik muncul setelah sesi pertama" saat
            // datanya kosong - sebelum repo siap itu belum tentu benar.
            <Card className="gap-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </Card>
          ) : (
            <WeeklyTrend />
          )}
        </View>

        <View className="gap-2 mt-2">
          <SectionHeader title={t("profile.reminderSection")} />
          <ReminderSettings />
        </View>

        <View className="gap-2 mt-2">
          <SectionHeader title={t("profile.achievementSection")} />
          {progressLoading ? (
            <Card className="gap-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </Card>
          ) : (
            <AchievementList />
          )}
        </View>

        <View className="gap-2 mt-2">
          <SectionHeader title={t("profile.avatarSection")} />
          <Card className="flex-row flex-wrap gap-2 justify-center">
            {AVATAR_CHOICES.map((a) => (
              <Pressable
                key={a}
                accessibilityRole="radio"
                accessibilityState={{ selected: profile.avatar === a }}
                onPress={() => profile.setAvatar(a)}
                className={`w-11 h-11 rounded-full items-center justify-center ${
                  profile.avatar === a ? "bg-brand-emerald/20 border border-brand-emerald" : "bg-white/5"
                }`}
              >
                <Text className="text-xl">{a}</Text>
              </Pressable>
            ))}
          </Card>
        </View>

        <View className="gap-2">
          <SectionHeader title={t("profile.reciterSection")} />
          <Card className="gap-2">
            {reciters.map((r) => (
              <Pressable
                key={r.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: profile.reciterId === r.id }}
                onPress={() => profile.setReciter(r.id)}
                className={`rounded-xl px-4 py-3 border ${
                  profile.reciterId === r.id ? "border-brand-emerald bg-brand-emerald/10" : "border-line bg-white/5"
                }`}
              >
                <Text className="text-ink-primary">{r.name}</Text>
              </Pressable>
            ))}
          </Card>
        </View>

        <View className="gap-2">
          <SectionHeader title={t("profile.arabScaleSection")} />
          <Card className="flex-row gap-2">
            {SCALES.map((s) => (
              <Pressable
                key={s.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: profile.arabFontScale === s.value }}
                onPress={() => profile.setArabicFontScale(s.value)}
                className={`flex-1 rounded-xl px-4 py-3 border items-center ${
                  profile.arabFontScale === s.value ? "border-brand-emerald bg-brand-emerald/10" : "border-line bg-white/5"
                }`}
              >
                <Text className="text-ink-primary">{t(`profile.arabScale.${s.value}` as TranslationKey)}</Text>
              </Pressable>
            ))}
          </Card>
        </View>

        {/* Bahasa UI. Tanpa blok ini "pilihan bahasa" tidak punya tempat, dan
           default Locale tidak akan pernah berubah — lihat core/i18n. */}
        <View className="gap-2">
          <SectionHeader title={t("profile.languageSection")} />
          <Card className="gap-2">
            {LANGUAGE_OPTIONS.map((option) => {
              const active = locale === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => setLocale(option.value)}
                  className={`rounded-xl px-4 py-3 border flex-row items-center justify-between ${
                    active ? "border-brand-emerald bg-brand-emerald/10" : "border-line bg-white/5"
                  }`}
                >
                  <Text className="text-ink-primary">{t(option.labelKey)}</Text>
                  {active ? <Text className="text-brand-emerald text-lg">✓</Text> : null}
                </Pressable>
              );
            })}
            <Text className="text-ink-secondary text-xs">{t("profile.languageHint")}</Text>
          </Card>
        </View>

        {/* RULES § 7.6: atribusi ini tidak boleh jadi catatan kecil di dalam
            Profil — ia jadi layar sendiri, karena sekarang memuat seluruh
            daftar hadis beserta rawi + nomornya, bukan satu baris ringkasan. */}
        <Pressable
          onPress={() => router.push("/about")}
          accessibilityRole="button"
          accessibilityLabel={t("profile.about")}
        >
          <Card className="flex-row items-center justify-between">
            <Text className="text-ink-primary font-sans-semibold">{t("profile.about")}</Text>
            {/* Ikon, bukan karakter segitiga: glyph itu tidak dimiliki font mana pun yang
                dibundel, jadi akan diambil dari font sistem — bentuknya beda tiap
                perangkat. */}
            <Ionicons name="chevron-forward" size={16} color="#9CA8A4" />
          </Card>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("profile.delete")}
          onPress={() =>
            Alert.alert(t("profile.deleteTitle"), t("profile.deleteBody"), [
              { text: t("profile.deleteCancel"), style: "cancel" },
              {
                text: t("profile.deleteConfirm"),
                style: "destructive",
                onPress: () => {
                  profile.resetAll();
                  void wipeAllProgress();
                },
              },
            ])
          }
          className="rounded-card border border-danger/40 bg-danger/10 px-5 min-h-[44px] items-center justify-center mt-2"
        >
          <Text className="text-danger font-sans-semibold">{t("profile.delete")}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
