/**
 * Layar lesson (PRD § 5.4) — presentasi tipis dari useLessonSession: fase
 * materi → latihan → hasil, plus exit-confirm inline (Alert di react-native-web
 * no-op, jadi dialog native tidak dipakai). Keluar di tengah sesi TIDAK
 * mencatat apa pun — pencatatan atomik hanya terjadi saat sesi tuntas
 * (kill-app safety, features/lessons/hooks.ts).
 */
import { useEffect, useState, type ReactNode } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { getSurahMeta } from "@/core/content/meta";
import { useT } from "@/core/i18n/hooks";
import { MateriPanel } from "@/features/lessons/components/MateriPanel";
import { QuestionCard } from "@/features/lessons/components/QuestionCard";
import { ResultPanel } from "@/features/lessons/components/ResultPanel";
import { useLessonSession } from "@/features/lessons/hooks";
import { getNextUnitIndex, getLessonUnit } from "@/features/lessons/units";
import { getAudioController } from "@/features/mushaf/audio/AudioController";
import { useAudio } from "@/features/mushaf/audio/hooks";
import { Button, Card, ConfettiOverlay } from "@/ui/components";

export default function Lesson() {
  const { t } = useT();
  const params = useLocalSearchParams<{ surahId: string; unitIndex: string }>();
  const router = useRouter();
  const surahId = Number(params.surahId);
  const unitIndex = Number(params.unitIndex ?? 0);
  const lesson = useLessonSession(surahId, unitIndex);
  const audio = useAudio();
  const [confirmExit, setConfirmExit] = useState(false);

  // Tinggal layar → audio berhenti (jangan ada suara tanpa UI kontrol).
  useEffect(() => () => void getAudioController().stop(), []);

  // Progress bar interpolasi halus 250ms tiap perubahan (DESIGN.md § 6).
  const barProgress = useSharedValue(0);
  useEffect(() => {
    barProgress.value = withTiming(lesson.progress, { duration: 250 });
  }, [lesson.progress, barProgress]);
  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.round(barProgress.value * 100)}%`,
  }));

  const meta = getSurahMeta(surahId);
  const unit = getLessonUnit(surahId, unitIndex);
  const view = lesson.view;
  const goHome = () => router.replace("/(tabs)");

  // Teks Quran dimuat terpisah dari bundle startup (docs/PERF.md). Selama itu jalan,
  // sesi belum dibuat sama sekali — tampil statusnya, jangan layar kosong yang terlihat
  // seperti surahnya memang kosong (RULES § 7.3).
  if (!lesson.textReady) {
    const failed = lesson.textStatus === "failed";
    return (
      <SafeAreaView className="flex-1 bg-bg-base px-4">
        <View className="flex-1 items-center justify-center gap-4">
          <Card variant="glass" className="items-center gap-2 min-w-[280px]">
            <Text className="text-ink-primary font-display text-xl text-center">
              {failed ? t("lesson.textFailed") : t("lesson.textLoading")}
            </Text>
            <Text className="text-ink-secondary text-sm text-center">
              {failed ? t("lesson.textFailedHint") : t("lesson.textLoadingHint")}
            </Text>
            <View className="mt-3 w-full">
              <Button
                label={failed ? t("common.retry") : t("notFound.backHome")}
                onPress={failed ? lesson.retryText : goHome}
              />
            </View>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  // Unit tak ada / generator gagal → not-found (fail-fast tertangkap layar).
  if (view === null || unit === undefined) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base px-4">
        <View className="flex-1 items-center justify-center gap-4">
          <Card variant="glass" className="items-center gap-2 min-w-[280px]">
            <Text className="text-ink-primary font-display text-xl text-center">
              {t("lesson.notFound.title")}
            </Text>
            <Text className="text-ink-secondary text-sm text-center">
              {t("lesson.notFound.subtitle")}
            </Text>
            <View className="mt-3 w-full">
              <Button label={t("notFound.backHome")} onPress={goHome} />
            </View>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  // Header + progress bar (fase materi & latihan; hasil punya tombolnya sendiri).
  const headerLabel =
    view.phase === "latihan"
      ? t("lesson.headerQuestion", { position: view.position, total: view.total })
      : t("lesson.headerUnit", { surah: meta?.nameLatin ?? "", unit: unitIndex + 1 });
  const header =
    view.phase === "hasil" ? null : (
      <View className="gap-2 px-4 pt-2 pb-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-ink-secondary text-xs uppercase tracking-widest font-sans-semibold">
            {headerLabel}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("lesson.exit")}
            hitSlop={12}
            onPress={() => setConfirmExit(true)}
            className="w-9 h-9 items-center justify-center rounded-full bg-white/5 active:opacity-80"
          >
            <Text className="text-ink-secondary text-base">✕</Text>
          </Pressable>
        </View>
        <View className="h-2 rounded-full bg-white/10 overflow-hidden">
          <Animated.View
            className="h-full rounded-full bg-brand-emerald"
            style={barStyle}
          />
        </View>
      </View>
    );

  let body: ReactNode = null;
  let footer: ReactNode = null;

  if (view.phase === "materi") {
    body = (
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8">
        <MateriPanel
          surahId={surahId}
          startAyah={unit.startAyah}
          endAyah={unit.endAyah}
          unlocked={lesson.materiUnlocked}
          onPlayAyah={lesson.playAyah}
          onStart={lesson.startPractice}
        />
      </ScrollView>
    );
  } else if (view.phase === "hasil") {
    const nextUnit = getNextUnitIndex(surahId, unitIndex);
    body = (
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8 pt-2">
        <ResultPanel
          view={view}
          outcome={lesson.outcome}
          nextUnitIndex={nextUnit ?? null}
          onNext={() => {
            if (nextUnit !== undefined) router.replace(`/lesson/${surahId}/${nextUnit}`);
          }}
          onRepeat={lesson.restart}
          onHome={goHome}
        />
      </ScrollView>
    );
  } else if (view.question !== null && view.view !== null) {
    const question = view.question;
    const questionView = view.view;
    const t4 = question.kind === "T4" ? question : null;
    const playingT4 =
      t4 !== null &&
      audio.status === "playing" &&
      audio.nowPlaying !== null &&
      audio.nowPlaying.surahId === t4.surahId &&
      audio.nowPlaying.ayahNumber === t4.ayahNumber;

    body = (
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-6">
        <QuestionCard
          question={question}
          view={questionView}
          position={view.position}
          onChoose={lesson.selectOption}
          onPlaceChunk={lesson.placeChunk}
          onRemoveChunk={lesson.removeChunk}
          onReplayAudio={() => {
            if (t4 !== null) lesson.playAyah(t4.ayahNumber);
          }}
          audioPlaying={playingT4}
          audioLoading={audio.status === "loading"}
          audioUnavailable={lesson.audioUnavailable}
        />
      </ScrollView>
    );

    footer = !questionView.checked ? (
      <View className="flex-row items-center gap-3 border-t border-line px-4 py-3">
        <Button
          testID="lesson-hint"
          label={t("lesson.hint")}
          variant="ghost"
          onPress={lesson.hint}
          disabled={!lesson.canUseHint}
        />
        <View className="flex-1">
          <Button
            testID="lesson-check"
            label={t("lesson.check")}
            onPress={lesson.submit}
            disabled={!lesson.canSubmit}
          />
        </View>
      </View>
    ) : (
      <View className="border-t border-line px-4 py-3">
        <Button testID="lesson-next" label={t("lesson.next")} onPress={lesson.next} />
      </View>
    );
  }

  return (
    <SafeAreaView testID={`lesson-phase-${view.phase}`} className="flex-1 bg-bg-base">
      {header}
      {body}
      {footer}

      {/* Konfeti perayaan (DESIGN.md § 6) — overlay isi-layar, non-interaktif. */}
      {view.phase === "hasil" ? <ConfettiOverlay /> : null}

      {/* Exit-confirm inline — Alert no-op di web (react-native-web). */}
      {confirmExit ? (
        <View
          className="absolute inset-0 items-center justify-center px-6"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
        >
          <Card variant="glass" className="w-full gap-3">
            <Text className="text-ink-primary font-display text-lg text-center">
              {t("lesson.exitConfirm.title")}
            </Text>
            <Text className="text-ink-secondary text-sm text-center leading-6">
              {t("lesson.exitConfirm.subtitle")}
            </Text>
            <View className="mt-2 gap-2">
              <Button label={t("lesson.exitConfirm.stay")} onPress={() => setConfirmExit(false)} />
              <Button label={t("lesson.exitConfirm.leave")} variant="ghost" onPress={goHome} />
            </View>
          </Card>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
