/**
 * Owner: ui/components. Button tiga varian (DESIGN.md § 7).
 */
import { Pressable, Text, View } from "react-native";

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  emoji?: string;
  /**
   * Hook untuk harness performa (RULES § 9), bukan untuk user: label ikut
   * diterjemahkan, jadi kalau harness mencari tombol lewat teks Indonesia
   * sekalian English sekalian patah. Yang diukur adalah "layar ini sudah bisa
   * diklik", bukan kalimat di atas tombolnya.
   */
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  emoji,
  testID,
}: ButtonProps) {
  const base =
    "min-h-[44px] rounded-card items-center justify-center px-6 flex-row gap-2 active:opacity-80";
  const variants = {
    primary: "bg-brand-emerald",
    secondary: "bg-white/10 border border-line",
    ghost: "bg-transparent",
  } as const;
  const textColors = {
    primary: "text-bg-base font-sans-bold",
    secondary: "text-ink-primary font-sans-semibold",
    ghost: "text-brand-emerald font-sans-semibold",
  } as const;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${disabled ? "opacity-40" : ""}`}
    >
      {emoji !== undefined ? <Text className="text-base">{emoji}</Text> : null}
      <Text className={`text-base ${textColors[variant]}`}>{label}</Text>
    </Pressable>
  );
}

/** View wrapper gradient-ish untuk primary (flat emerald + glow ring di Phase 3). */
export function ButtonGlow({ children }: { children: React.ReactNode }) {
  return (
    <View className="rounded-card shadow-lg shadow-brand-emerald/40">
      {children}
    </View>
  );
}
