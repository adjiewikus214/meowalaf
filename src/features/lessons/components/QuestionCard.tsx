/**
 * Owner: features/lessons/components. Kartu soal T1–T4 (PRD § 5.4) — presentasi
 * murni dari LessonView (session.ts), tanpa logika menilai. Kenapa di features,
 * bukan ui/components: kartu ini butuh tipe domain Question (features/lessons) —
 * ui tidak boleh meng-import features (ARCHITECTURE.md § 3); AnswerOption &
 * AyahBlock generik tetap di ui.
 *
 * Feedback inline selalu ada saat salah (explain = terjemahan benar, PRD § 5.4).
 */
import { useEffect, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useT } from "@/core/i18n/hooks";
import type { TranslationKey } from "@/core/i18n";
import { ARAB_FONT_SIZES, MOTION } from "@/ui/tokens";
import { CatMascot, TransliteratedText, type CatMood } from "@/ui/components";
import { AnswerOption, type AnswerOptionState } from "@/ui/components/AnswerOption";

import { lessonReaction } from "../reaction";
import type { QuestionView } from "../session";
import type { Question } from "../types";

const MARKERS = ["A", "B", "C"] as const;
const MAX_T2_SLOTS = 6;
const POP_DURATION = 90; // pop benar 2×90 ≈ 180ms spring (DESIGN.md § 6)
const SHAKE_STEP = 55; // shake 4×55 = 220ms (DESIGN.md § 6)

/**
 * Transisi masuk (DESIGN.md § 6): fade + slide-up tiap ganti soal. Pakai
 * `key` di QuestionCard agar animasi jalan ulang untuk tiap soal baru;
 * reduced-motion → fade sederhana tanpa geser (aturan § 6).
 */
function RiseIn({
  children,
  duration,
  reduced,
}: {
  children: ReactNode;
  duration: number;
  reduced: boolean;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.Never, // fade = pengganti wajib saat reduced (§ 6)
    });
  }, [progress, duration, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduced ? [] : [{ translateY: (1 - progress.value) * 14 }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

export type QuestionCardProps = {
  question: Question;
  view: QuestionView;
  /** Posisi soal 1-based — dipakai Abu untuk memilih kalimat penyemangat. */
  position: number;
  onChoose: (optionIndex: number) => void;
  onPlaceChunk: (displayIndex: number) => void;
  onRemoveChunk: (position: number) => void;
  /** T4: putar/putar ulang audio ayat. */
  onReplayAudio: () => void;
  audioPlaying?: boolean;
  audioLoading?: boolean;
  /** true bila audio gagal dimuat → tombol putar menampilkan pesan degradasi. */
  audioUnavailable?: boolean;
};

/** Kunci judul per tipe soal; copy-nya sendiri ada di kamus (core/i18n). */
function promptKeyFor(question: Question): TranslationKey {
  switch (question.kind) {
    case "T1":
      return "lesson.prompt.T1";
    case "T2":
      return "lesson.prompt.T2";
    case "T3":
      return "lesson.prompt.T3";
    case "T4":
      return "lesson.prompt.T4";
  }
}

function optionState(view: QuestionView, question: Question, index: number): AnswerOptionState {
  if (view.kind !== "choice" || question.kind === "T2") return "idle";
  if (view.eliminatedIndex === index) return "eliminated";
  if (view.checked) {
    if (index === question.correctIndex) return "correct";
    if (index === view.selectedIndex) return "wrong";
    return "idle";
  }
  return view.selectedIndex === index ? "selected" : "idle";
}

function ChoiceBody({
  question,
  view,
  onChoose,
}: {
  question: Question;
  view: QuestionView;
  onChoose: (index: number) => void;
}) {
  if (question.kind === "T2" || view.kind !== "choice") return null;
  const locked = view.checked || view.selectedIndex !== null;
  return (
    <View className="gap-3">
      {question.options.map((option, index) => (
        <AnswerOption
          key={index}
          testID={`lesson-answer-${index}`}
          label={option}
          marker={MARKERS[index] ?? String(index + 1)}
          state={optionState(view, question, index)}
          script={question.kind === "T3" ? "arabic" : "latin"}
          disabled={locked}
          onPress={() => onChoose(index)}
        />
      ))}
    </View>
  );
}

function OrderBody({
  question,
  view,
  onPlaceChunk,
  onRemoveChunk,
}: {
  question: Extract<Question, { kind: "T2" }>;
  view: QuestionView;
  onPlaceChunk: (displayIndex: number) => void;
  onRemoveChunk: (position: number) => void;
}) {
  const { t } = useT();
  if (view.kind !== "order") return null;
  const placed = view.placed;
  const isSlotCorrect = (position: number): boolean | null => {
    if (!view.checked) return null;
    return placed[position] === question.correctOrder[position];
  };
  const bank = question.chunks
    .map((text, displayIndex) => ({ text, displayIndex }))
    .filter((chunk) => !placed.includes(chunk.displayIndex));
  const revealed = view.revealedCount;

  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text className="text-ink-secondary text-xs uppercase tracking-widest font-sans-semibold">
          {t("lesson.orderLabel")}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {Array.from({ length: Math.min(MAX_T2_SLOTS, question.chunks.length) }, (_, position) => {
            const displayIndex = placed[position];
            const correct = isSlotCorrect(position);
            const border =
              correct === true ? "border-success" : correct === false ? "border-danger" : "border-line";
            const filled = displayIndex !== undefined;
            return (
              <Pressable
                key={position}
                accessibilityRole="button"
                accessibilityLabel={
                  filled
                    ? t("lesson.slotFilled", { position: position + 1 })
                    : t("lesson.slotEmpty", { position: position + 1 })
                }
                disabled={!filled || view.checked}
                onPress={() => onRemoveChunk(position)}
                className={`min-h-[44px] min-w-[64px] px-3 rounded-card border ${border} ${
                  filled ? "bg-white/5" : "bg-white/[0.02]"
                } items-center justify-center active:opacity-80`}
              >
                <Text
                  className={`font-arab text-ink-arab text-right text-lg leading-8 ${
                    correct === false ? "text-danger" : ""
                  }`}
                  style={{ writingDirection: "rtl" }}
                >
                  {displayIndex !== undefined ? question.chunks[displayIndex] : "▢"}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {revealed > 0 ? (
          <Text className="text-brand-violet text-xs">
            {t("lesson.hintUsed", { count: revealed })}
          </Text>
        ) : null}
      </View>

      <View className="flex-row flex-wrap gap-2">
        {bank.length === 0 ? (
          <Text className="text-ink-secondary text-sm">{t("lesson.allPlaced")}</Text>
        ) : (
          bank.map((chunk) => (
            <Pressable
              key={chunk.displayIndex}
              accessibilityRole="button"
              accessibilityLabel={t("lesson.placeChunk", { text: chunk.text })}
              disabled={view.checked}
              onPress={() => onPlaceChunk(chunk.displayIndex)}
              className="min-h-[44px] px-4 rounded-card border border-line bg-white/5 items-center justify-center active:opacity-80"
            >
              <Text className="font-arab text-ink-arab text-right text-lg leading-8" style={{ writingDirection: "rtl" }}>
                {chunk.text}
              </Text>
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}

/**
 * Banner hasil cek: benar → success, salah → explain (terjemahan benar).
 * Slide-up 220ms; reduced → fade (DESIGN.md § 6).
 *
 * Abu muncul di **baris verdict** — momen meta ("bener/salah"), bukan ayat.
 * Terjemahan ayat dipisah garis di bawahnya, jadi maskot tidak pernah
 * bersebelahan dengan teks ayat (RULES § 7.9).
 */
function Feedback({
  verdict,
  explain,
  reduced,
  mood,
  lineKey,
}: {
  verdict: "correct" | "wrong";
  explain: string | null;
  reduced: boolean;
  mood: CatMood;
  lineKey: TranslationKey;
}) {
  const correct = verdict === "correct";
  const { t } = useT();
  return (
    <RiseIn duration={MOTION.base} reduced={reduced}>
      <View
        className={`rounded-card border p-4 gap-3 ${correct ? "bg-success/10 border-success" : "bg-danger/10 border-danger"}`}
        accessibilityLiveRegion="polite"
      >
        <View className="flex-row items-center gap-3">
          <CatMascot testID="lesson-abu" size={56} mood={mood} />
          <View className="flex-1 gap-0.5">
            <Text className={`font-sans-bold text-base ${correct ? "text-success" : "text-danger"}`}>
              {correct ? t("lesson.correct") : t("lesson.wrong")}
            </Text>
            <Text className="text-ink-secondary text-xs leading-5">{t(lineKey)}</Text>
          </View>
        </View>
        {explain !== null && !correct ? (
          <View className="border-t border-line pt-3">
            <TransliteratedText className="text-ink-primary text-sm leading-6" text={explain} />
          </View>
        ) : null}
      </View>
    </RiseIn>
  );
}

export function QuestionCard({
  question,
  view,
  position,
  onChoose,
  onPlaceChunk,
  onRemoveChunk,
  onReplayAudio,
  audioPlaying = false,
  audioLoading = false,
  audioUnavailable = false,
}: QuestionCardProps) {
  const isRetry = view.isRetry;
  const { t } = useT();
  const reduced = useReducedMotion() === true;
  // Hint untuk soal ini: eliminasi opsi (pilihan) atau potongan yang dibantu (T2).
  const hintUsed = view.kind === "choice" ? view.eliminatedIndex !== null : view.revealedCount > 0;
  const reaction =
    view.checked && view.verdict !== null
      ? lessonReaction({ verdict: view.verdict, position, isRetry, hintUsed })
      : null;
  const scale = useSharedValue(1);
  const shakeX = useSharedValue(0);

  // DESIGN.md § 6: benar → pop 1→1.04→1 (spring); salah → shake kecil 220ms.
  // Reduced-motion: keduanya dilewati — feedback tetap lewat fade banner.
  useEffect(() => {
    if (!view.checked || view.verdict === null || reduced) return;
    if (view.verdict === "correct") {
      scale.value = withSequence(
        withSpring(1.04, { duration: POP_DURATION * 2 }),
        withSpring(1, { duration: POP_DURATION * 2 }),
      );
    } else {
      shakeX.value = withSequence(
        withTiming(-6, { duration: SHAKE_STEP }),
        withTiming(6, { duration: SHAKE_STEP }),
        withTiming(-4, { duration: SHAKE_STEP }),
        withTiming(0, { duration: SHAKE_STEP }),
      );
    }
  }, [view.checked, view.verdict, reduced, scale, shakeX]);

  const rootStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: shakeX.value }],
  }));

  return (
    <Animated.View style={rootStyle}>
      <RiseIn
        key={`${question.id}:${isRetry ? "retry" : "first"}`}
        duration={MOTION.fast}
        reduced={reduced}
      >
        <View className="gap-5">
      <View className="flex-row items-center justify-between">
        <Text className="text-ink-secondary text-xs uppercase tracking-widest font-sans-semibold">
          {t(promptKeyFor(question))}
        </Text>
        {isRetry ? (
          <View className="bg-warn/15 border border-warn/40 rounded-full px-3 py-1">
            <Text className="text-warn text-[10px] font-sans-semibold">{t("lesson.retryBadge")}</Text>
          </View>
        ) : null}
      </View>

      {/* Area prompt per tipe soal */}
      {question.kind === "T1" || question.kind === "T4" ? (
        question.kind === "T1" ? (
          <View className="bg-bg-elevated border border-line rounded-card p-5">
            <Text
              style={{ fontSize: ARAB_FONT_SIZES.M, lineHeight: ARAB_FONT_SIZES.M * 1.9 }}
              className="font-arab text-ink-arab text-right"
            >
              {question.ayahArabic}
            </Text>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              audioUnavailable
                ? t("lesson.audioUnavailableLabel")
                : audioPlaying
                  ? t("lesson.audioPlayingLabel")
                  : t("lesson.audioPlayLabel")
            }
            onPress={onReplayAudio}
            className={`bg-bg-elevated border rounded-card p-5 items-center gap-2 active:opacity-80 ${
              audioUnavailable ? "border-warn/50" : "border-line"
            }`}
          >
            <View className="w-14 h-14 rounded-full bg-brand-emerald/15 items-center justify-center">
              <Text className="text-2xl">{audioUnavailable ? "🔇" : audioPlaying ? "⏸️" : "🔊"}</Text>
            </View>
            <Text className="text-ink-secondary text-sm text-center">
              {audioUnavailable
                ? t("lesson.audioUnavailable")
                : audioLoading
                  ? t("lesson.audioLoading")
                  : audioPlaying
                    ? t("lesson.audioPlaying")
                    : t("lesson.audioTap")}
            </Text>
          </Pressable>
        )
      ) : question.kind === "T3" ? (
        <View className="bg-bg-elevated border border-line rounded-card p-5 gap-2">
          <Text className="text-ink-secondary text-xs">
            {t("lesson.ayahOpenedWith", { ayah: question.ayahNumber })}
          </Text>
          <Text
            style={{ fontSize: ARAB_FONT_SIZES.M, lineHeight: ARAB_FONT_SIZES.M * 1.9 }}
            className="font-arab text-ink-arab text-right"
          >
            {question.ayahStart}
          </Text>
        </View>
      ) : (
        <View className="bg-bg-elevated border border-line rounded-card p-5 gap-2">
          <Text className="text-ink-secondary text-xs">{t("lesson.translationLabel")}</Text>
          <TransliteratedText className="text-ink-primary text-base leading-6" text={question.translation} />
        </View>
      )}

      {/* Body jawaban */}
      {question.kind === "T2" ? (
        <OrderBody question={question} view={view} onPlaceChunk={onPlaceChunk} onRemoveChunk={onRemoveChunk} />
      ) : (
        <ChoiceBody question={question} view={view} onChoose={onChoose} />
      )}

      {/* Feedback inline setelah dicek */}
      {view.checked && view.verdict !== null && reaction !== null ? (
        <Feedback
          verdict={view.verdict}
          explain={view.feedback}
          reduced={reduced}
          mood={reaction.mood}
          lineKey={reaction.lineKey}
        />
      ) : null}
        </View>
      </RiseIn>
    </Animated.View>
  );
}