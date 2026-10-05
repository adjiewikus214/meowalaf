/**
 * Owner: ui/components. Toast achievement (DESIGN.md § 6: peringatan celebratory
 * masuk dari atas, tahan, lalu keluar). Presentasi murni — caller yang menentukan
 * achievement mana & kapan dismiss; komponen hanya menjalankan gerakannya.
 *
 * Gerak: turun dari luar layar + fade masuk (ease back sedikit), tahan, lalu naik
 * keluar. Durasi dari token MOTION (§ 6). prefers-reduced-motion → hanya fade,
 * tanpa geser (aturan § 6).
 *
 * Toast TIDAK di-mount saat kosong: kalau hanya disembunyikan dengan opacity,
 * reader layar tetap membacakan "achievement terbuka" kosong tiap kalipo Dial.
 * Pointer-events off supaya tidak pernah menghalangi tap di bawahnya.
 */
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MOTION } from "@/ui/tokens";

/** Berapa lama toast terlihat sebelum memanggil onDismiss. */
const HOLD_MS = 2600;

/** Jarak dari atas layar saat tersembunyi — cukup buat keluar frame. */
const OFFSCREEN = -160;

export type AchievementToastProps = {
  visible: boolean;
  emoji: string;
  title: string;
  description: string;
  /**
   * Label hadiah, mis. "+25 XP". Opsional & berupa teks bebas supaya ui tetap
   * tidak tahu apa pun soal achievement — pemanggil yang memformat (lihat
   * formatAchievementXp di features/gamification).
   */
  reward?: string;
  /** Dipanggil setelah animasi keluar selesai — caller mengosongkan toast ini. */
  onDismiss: () => void;
};

export function AchievementToast({
  visible,
  emoji,
  title,
  description,
  reward,
  onDismiss,
}: AchievementToastProps) {
  const reduced = useReducedMotion() === true;
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  // Mount selama tampil + selama animasi keluar; di-unmount setelah keluar selesai.
  const [mounted, setMounted] = useState(false);

  // onDismiss sering re-created tiap render parent; ref supaya animasi tidak restart.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = reduced
        ? withTiming(1, { duration: MOTION.fast, reduceMotion: ReduceMotion.Never })
        : withTiming(1, { duration: MOTION.slow, easing: Easing.out(Easing.back(1.4)) });
      const hide = setTimeout(() => dismissRef.current(), HOLD_MS);
      return () => clearTimeout(hide);
    }
    // Keluar: fade + naik lagi, lalu unmount. Durasi unmount pakai TIMER JS, bukan
    // callback animasi — callback itu jalan di UI thread dan bisa tiba SETELAH
    // animasi masuk berikutnya dimulai, sehingga toast yang sedang muncul langsung
    // ke-unmount (kilatan ~1 frame). Timer JS selalu bisa dibatalkan oleh cleanup.
    progress.value = withTiming(0, {
      duration: MOTION.base,
      easing: Easing.in(Easing.quad),
      reduceMotion: ReduceMotion.Never,
    });
    const unmount = setTimeout(() => setMounted(false), MOTION.base);
    return () => clearTimeout(unmount);
  }, [visible, progress, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduced ? [] : [{ translateY: OFFSCREEN * (1 - progress.value) }],
  }));

  if (!mounted) return null;

  return (
    <View
      pointerEvents="none"
      className="absolute inset-x-0 top-0 items-center px-4"
      style={{ paddingTop: insets.top + 8 }}
    >
      <Animated.View
        style={animatedStyle}
        accessibilityRole="alert"
        accessibilityLabel={`Achievement terbuka: ${title}. ${description}${
          reward === undefined ? "" : ` Hadiah ${reward}.`
        }`}
        className="w-full max-w-[420px] rounded-card border border-brand-violet bg-bg-elevated px-4 py-3 flex-row items-center gap-3"
      >
        <View className="w-11 h-11 rounded-full bg-brand-violet/15 items-center justify-center">
          <Text className="text-2xl">{emoji}</Text>
        </View>
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-2">
            <Text className="text-[10px] uppercase tracking-widest font-sans-semibold text-brand-violet">
              achievement terbuka
            </Text>
            {reward !== undefined ? (
              <View className="rounded-full bg-brand-emerald/15 px-2 py-0.5">
                <Text className="text-[10px] font-sans-semibold text-brand-emerald">{reward}</Text>
              </View>
            ) : null}
          </View>
          <Text className="text-ink-primary font-sans-semibold">{title}</Text>
          <Text className="text-ink-secondary text-xs">{description}</Text>
        </View>
      </Animated.View>
    </View>
  );
}