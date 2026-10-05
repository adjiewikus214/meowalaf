/**
 * Owner: ui/components. Baris opsi jawaban (DESIGN.md § 7 `AnswerOption`) —
 * status idle/selected/correct/wrong/eliminated. Murni presentasi: parent
 * (features/lessons) yang memutuskan status dari state soal.
 */
import { Pressable, Text, View } from "react-native";

import { TOUCH_TARGET } from "../tokens";
import { TransliteratedText } from "./TransliteratedText";

export type AnswerOptionState = "idle" | "selected" | "correct" | "wrong" | "eliminated";

export type AnswerOptionProps = {
  label: string;
  state?: AnswerOptionState;
  /** Skrip teks: latin (terjemahan) atau arabic (potongan/awal ayat). */
  script?: "latin" | "arabic";
  /** Label pendek di tepi kiri (mis. "A" / nomor opsi). */
  marker?: string;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
};

const CONTAINER: Record<AnswerOptionState, string> = {
  idle: "bg-white/5 border-line",
  selected: "bg-brand-emerald/15 border-brand-emerald",
  correct: "bg-success/15 border-success",
  wrong: "bg-danger/15 border-danger",
  eliminated: "bg-white/[0.02] border-line opacity-40",
};

const MARKER_BORDER: Record<AnswerOptionState, string> = {
  idle: "border-line",
  selected: "border-brand-emerald",
  correct: "border-success",
  wrong: "border-danger",
  eliminated: "border-line",
};

const MARKER_TEXT: Record<AnswerOptionState, string> = {
  idle: "text-ink-secondary",
  selected: "text-brand-emerald",
  correct: "text-success",
  wrong: "text-danger",
  eliminated: "text-ink-secondary",
};

export function AnswerOption({
  label,
  state = "idle",
  script = "latin",
  marker,
  onPress,
  disabled = false,
  testID,
}: AnswerOptionProps) {
  const interactive = onPress !== undefined && !disabled;
  const content = (
    <View className="flex-row items-center gap-3">
      {marker !== undefined ? (
        <View className={`w-7 h-7 rounded-full border items-center justify-center ${MARKER_BORDER[state]}`}>
          <Text className={`text-xs font-sans-semibold ${MARKER_TEXT[state]}`}>{marker}</Text>
        </View>
      ) : null}
      <Text
        className={`flex-1 ${script === "arabic" ? "font-arab text-ink-arab text-right text-xl leading-9" : "text-ink-primary text-base"} ${
          state === "eliminated" ? "line-through" : ""
        }`}
        style={script === "arabic" ? { writingDirection: "rtl" } : undefined}
      >
        {/* Label Latin = potongan terjemahan ayat, jadi bisa memuat ṣ/ṭ/ẓ. */}
        {script === "arabic" ? label : <TransliteratedText text={label} />}
      </Text>
      {state === "correct" ? <Text className="text-success text-lg">✓</Text> : null}
      {state === "wrong" ? <Text className="text-danger text-lg">✕</Text> : null}
    </View>
  );

  if (!interactive) {
    return (
      <View
        testID={testID}
        accessibilityRole="text"
        accessibilityLabel={label}
        style={{ minHeight: TOUCH_TARGET }}
        className={`rounded-card border p-4 justify-center ${CONTAINER[state]}`}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: state === "selected" }}
      onPress={onPress}
      disabled={disabled}
      style={{ minHeight: TOUCH_TARGET }}
      className={`rounded-card border p-4 justify-center active:opacity-80 ${CONTAINER[state]}`}
    >
      {content}
    </Pressable>
  );
}