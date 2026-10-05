/**
 * Home bento (PRD § 5.2) — Phase 2: streak + XP level + ring target harian dari
 * store progres, dan tombol "Lanjut Ngaji" aktif menuju posisi lesson terakhir
 * (lesson-position store). Terakhir dibaca tetap dari reading store.
 *
 * ADR-009 (Home tampil sebelum SQLite selesai dibuka): angka yang berasal dari
 * SQLite tidak boleh tampil sebagai 0 sebelum repo siap - "0" itu klaim, bukan
 * "belum tahu". Jadi bagian itu diganti placeholder, sementara isi yang dari
 * AsyncStorage (sapaan, target, "lanjut: ...", quest, terakhir dibaca) tetap
 * tampil utuh. Tombol "Lanjut Ngaji" juga disables sampai repo final: dengan
 * begitu tidak ada satu pun lesson yang bisa menulis sebelum storage siap.
 */
import { useEffect } from "react";
import { Link, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  Card,
  SectionHeader,
  Button,
  HadithCard,
  EmptyState,
  ProgressRing,
  Skeleton,
  StreakFlame,
  XPBadge,
  QuestItem,
} from "@/ui/components";
import { Ionicons } from "@/ui/icons";
import { getSurahMeta } from "@/core/content/meta";
import { useT } from "@/core/i18n/hooks";
import { todayWib } from "@/core/time/wib";
import { DEFAULT_LESSON_POSITION, useLessonPositionStore } from "@/core/progress/lesson-position";
import { hadithForDay } from "@/features/home/hadith";
import { isProgressLoading, useHydrationStore } from "@/core/progress/hydration-store";
import { useProgressEventsStore } from "@/core/progress/lesson-store";
import { useProfileStore } from "@/core/progress/store";
import { useReadingStore } from "@/core/progress/reading";
import { levelProgress } from "@/core/progress/xp";
import { getLessonUnit } from "@/features/lessons/units";
import { useQuestStore } from "@/features/gamification/quest-store";
import { isQuestComplete, questDayStats, questProgress } from "@/features/gamification/quests";
import { tasbihTotal } from "@/features/tasbih/tasbih";
import { useTasbihStore } from "@/features/tasbih/tasbih-store";
import { computePrayerTimes, localClock, localDay, nextPrayer } from "@/core/prayer/times";
import { formatLocationLabel, resolveLocation } from "@/features/prayer/prayer-plan";
import { usePrayerLocationStore } from "@/features/prayer/prayer-location-store";

export default function Home() {
  const router = useRouter();
  const { t, locale } = useT();
  const displayName = useProfileStore((s) => s.displayName);
  const avatar = useProfileStore((s) => s.avatar);
  const arabFontScale = useProfileStore((s) => s.arabFontScale);
  const dailyTarget = useProfileStore((s) => s.dailyTarget);
  const lastRead = useReadingStore((s) => s.lastRead);
  const lastReadMeta = lastRead !== null ? getSurahMeta(lastRead.surahId) : undefined;

  const streakCount = useProgressEventsStore((s) => s.streakCount);
  const lessonsToday = useProgressEventsStore((s) => s.lessonsToday);
  // Angka progres belum nyata selama repo belum siap -> placeholder, bukan 0.
  const progressStatus = useProgressEventsStore((s) => s.status);
  const hydrationPhase = useHydrationStore((s) => s.phase);
  const progressLoading = isProgressLoading(hydrationPhase, progressStatus);
  // XP LIFETIME (lesson_log + xp_ledger) untuk level + angka "total", bukan
  // xpTotal harian — supaya Home dan Profil nunjukin angka yang sama (satu
  // sumber kebenaran). xpTotal harian tetap dipakai untuk konteks harian.
  const lifetimeXp = useProgressEventsStore((s) => s.stats.totalXp);
  const level = levelProgress(lifetimeXp);

  const position = useLessonPositionStore((s) => s.current) ?? DEFAULT_LESSON_POSITION;
  const positionMeta = getSurahMeta(position.surahId);
  const positionUnit = getLessonUnit(position.surahId, position.unitIndex);
  const target = Math.max(1, dailyTarget);
  const remaining = Math.max(0, target - lessonsToday);

  // Quest hari ini — roll otomatis kalau sudah ganti hari WIB (AC PRD § 5.5).
  const questState = useQuestStore();
  useEffect(() => {
    useQuestStore.getState().ensureToday();
    // Tasbih juga roll harian (hitungan reset tengah malam WIB).
    useTasbihStore.getState().ensureToday();
  }, []);
  const tasbihState = useTasbihStore();
  const tasbihTarget = tasbihState.target;
  const questStats = questDayStats(questState);

  // Baris pintas salat: jadwal dihitung lokal dari lokasi tersimpan (ADR-010).
  // Dihitung di render, bukan di-memo: biayanya mikrodetik dan useMemo atas
  // `new Date()` justru menyembunyikan bahwa angka ini menua antar render.
  const prayerState = usePrayerLocationStore();
  const prayerLocation = resolveLocation(prayerState);
  const prayerNow = new Date();
  const prayerSchedule = computePrayerTimes({
    lat: prayerLocation.lat,
    lng: prayerLocation.lng,
    tzOffsetMinutes: prayerLocation.tzOffsetMinutes,
    date: localDay(prayerNow, prayerLocation.tzOffsetMinutes),
  });
  const prayerNext = nextPrayer(
    prayerSchedule,
    localClock(prayerNow, prayerLocation.tzOffsetMinutes).minutes,
  );
  const prayerNextTime =
    prayerSchedule.times.find((time) => time.id === prayerNext.id) ?? prayerSchedule.times[0];

  const startLesson = () => router.push(`/lesson/${position.surahId}/${position.unitIndex}`);
  // Hadis hari ini berganti tiap hari WIB — murni dari tanggal, tanpa state
  // (lihat features/home/hadith.ts).
  const hadith = hadithForDay(todayWib());

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8 gap-4">
        <View className="flex-row items-center justify-between pt-2">
          <View>
            <Text className="text-ink-secondary text-sm">{t("home.greeting")}</Text>
            <Text className="text-ink-primary font-display text-2xl">
              {avatar} {displayName}
            </Text>
          </View>
          {progressLoading ? (
            <Skeleton className="h-14 w-24 rounded-card" />
          ) : (
            <StreakFlame testID="home-streak" count={streakCount} caption={t("streak.days")} />
          )}
        </View>

        <Card variant="glass" className="mt-2">
          <Text className="text-ink-secondary text-sm">{t("home.todayTarget")}</Text>
          <View className="flex-row items-center gap-4 mt-3">
            {progressLoading ? (
              // Cermin struktur ProgressRing (min-w + padding) supaya tidak ada
              // lompatan layout saat placeholder diganti angka asli.
              <View className="min-w-[96px] px-2 items-center justify-center">
                <Skeleton className="h-24 w-24 rounded-full" />
              </View>
            ) : (
              <ProgressRing
                testID="home-progress-ring"
                progress={lessonsToday / target}
                label={`${lessonsToday}/${target}`}
                sublabel={t("home.ringSublabel")}
              />
            )}
            <View className="flex-1 gap-2">
              {progressLoading ? (
                <>
                  <Skeleton className="h-14 w-40 rounded-card" />
                  <Skeleton className="h-4 w-52" />
                </>
              ) : (
                <>
                  <XPBadge
                    testID="home-level"
                    level={level.level}
                    xpInLevel={level.xpInLevel}
                    xpLevelSpan={level.xpLevelSpan}
                    totalXp={lifetimeXp}
                  />
                  <Text className="text-ink-secondary text-xs leading-5">
                    {remaining === 0 ? t("home.targetDone") : t("home.remaining", { count: remaining })}
                  </Text>
                </>
              )}
            </View>
          </View>
          <View className="mt-4 gap-1">
            <Text className="text-ink-secondary text-xs">
              {t("home.upNext", {
                surah: positionMeta?.nameLatin ?? "",
                unit: position.unitIndex + 1,
              })}
              {positionUnit !== undefined
                ? t("home.upNextAyah", { start: positionUnit.startAyah, end: positionUnit.endAyah })
                : ""}
            </Text>
            {progressLoading ? (
              <Text testID="home-progress-placeholder" className="text-ink-secondary text-xs">
                {t("home.preparingProgress")}
              </Text>
            ) : null}
            {/* Disabled sampai repo final: tidak ada lesson yang boleh menulis ke
                storage yang belum final, jadi upgrade in-memory -> SQLite tidak
                mungkin menimpa sesi yang sedang berjalan (lihat ADR-009). */}
            <Button
              testID="home-continue"
              label={t("home.continue")}
              onPress={startLesson}
              disabled={progressLoading}
            />
          </View>
        </Card>

        <View className="gap-2">
          <SectionHeader title={t("home.questsToday")} />
          {/* Quest berasal dari AsyncStorage (bukan SQLite), jadi progress-nya
              nyata sejak awal - jangan di-skeleton: menyembunyikan data yang
              sudah benar hanya menambah jeda tanpa alasan. */}
          {questState.quests.map((quest) => (
            <QuestItem
              key={quest.id}
              title={t(quest.titleKey)}
              value={questProgress(quest, questStats)}
              goal={quest.goal}
              done={isQuestComplete(quest, questStats)}
              xp={quest.xpReward}
              footer={t("quest.resetsAtMidnight")}
            />
          ))}
        </View>

        {/* Tasbih digital (PRD § 5.5) — baris pintas, bukan tab keempat: tab
            tetap 3, dan dzikir lebih sering dibuka sekilas daripada dibaca lama. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("tasbih.title")}
          onPress={() => router.push("/tasbih")}
          className="bg-bg-elevated border border-line rounded-card px-4 py-3 flex-row items-center gap-3 active:opacity-80 mt-2"
        >
          <View className="w-9 h-9 rounded-xl bg-brand-emerald/15 items-center justify-center">
            <Ionicons name="sync" size={17} color="#10B981" />
          </View>
          <View className="flex-1">
            <Text className="text-ink-primary font-sans-semibold">{t("tasbih.title")}</Text>
            <Text className="text-ink-secondary text-xs">
              {t("tasbih.homeHint", { count: tasbihTotal(tasbihState), target: tasbihTarget })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#9CA8A4" />
        </Pressable>

        {/* Jadwal salat & kiblat (ADR-010) — baris pintas yang langsung menyebut
            waktu berikutnya, karena itu info yang dicari user tanpa membuka layar. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("prayer.title")}
          testID="home-prayer-row"
          onPress={() => router.push("/prayer")}
          className="bg-bg-elevated border border-line rounded-card px-4 py-3 flex-row items-center gap-3 active:opacity-80"
        >
          <View className="w-9 h-9 rounded-xl bg-brand-emerald/15 items-center justify-center">
            <Ionicons name="time-outline" size={18} color="#10B981" />
          </View>
          <View className="flex-1">
            <Text className="text-ink-primary font-sans-semibold">{t("prayer.title")}</Text>
            <Text className="text-ink-secondary text-xs">
              {prayerNextTime === undefined
                ? t("prayer.today")
                : t("prayer.homeHint", {
                    prayer: t(prayerNextTime.labelKey),
                    time: `${String(Math.floor(prayerNext.minutes / 60)).padStart(2, "0")}:${String(prayerNext.minutes % 60).padStart(2, "0")}`,
                    city: formatLocationLabel(prayerLocation, locale),
                  })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#9CA8A4" />
        </Pressable>

        {/* Hadis hari ini (BRAND.md § 5). Ditaruh SETELAH CTA utama & quest — bukan
            sebelum — supaya "Lanjut Ngaji" tetap di atas fold (DESIGN.md § 4).
            Tanpa maskot di dalamnya: teks suci tidak boleh punya maskot di
            sisinya (BRAND.md § 6.1 / RULES § 7.9), dan hadis adalah teks suci. */}
        <View className="gap-2 mt-2">
          <SectionHeader title={t("home.hadithTitle")} />
          <HadithCard
            arabic={hadith.arabic}
            translation={t(hadith.textKey)}
            attribution={t(hadith.attributionKey)}
            fontScale={arabFontScale}
          />
        </View>

        <View className="gap-2 mt-2">
          <SectionHeader title={t("home.lastRead")} />
          {lastRead !== null && lastReadMeta !== undefined ? (
            <Link
              href={`/surah/${lastRead.surahId}`}
              accessibilityRole="link"
              asChild
            >
              <PressableLink
                latin={lastReadMeta.nameLatin}
                arabic={lastReadMeta.nameArabic}
                continueLabel={t("home.ayahContinue", { ayah: lastRead.ayahNumber })}
              />
            </Link>
          ) : (
            <Card>
              <EmptyState
                mood="sleepy"
                title={t("home.lastReadEmpty.title")}
                subtitle={t("home.lastReadEmpty.subtitle")}
              />
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PressableLink({
  latin,
  arabic,
  continueLabel,
}: {
  latin: string;
  arabic: string;
  /** Sudah terlokalisasi di pemanggil (Home), jadi komponen ini bebas bahasa. */
  continueLabel: string;
}) {
  return (
    <View className="bg-bg-elevated border border-line rounded-card p-5 flex-row items-center justify-between active:opacity-80">
      <View>
        <Text className="text-ink-primary font-sans-bold text-base">{latin}</Text>
        <Text className="text-ink-secondary text-sm">{continueLabel}</Text>
      </View>
      <Text className="font-arab text-ink-arab text-2xl">{arabic}</Text>
    </View>
  );
}
