/**
 * Owner: ui/components. Konfeti perayaan (DESIGN.md § 6: konfeti 600–1200ms;
 * § 7: ConfettiOverlay) — overlay absolut di atas layar, pointer-events off,
 * pure presentasi tanpa tahu konteks reward. Warna dari token theme (§ 2);
 * potongan deterministik (tanpa Math.random). prefers-reduced-motion aktif →
 * potongan diam & fade sederhana, tanpa jatuh/putar (aturan § 6).
 */
import { useEffect, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

/** Palet token theme (DESIGN.md § 2) — string literal, jangan di-interpolate. */
const COLORS = [
  "bg-brand-emerald",
  "bg-brand-violet",
  "bg-brand-pink",
  "bg-flame",
  "bg-brand-teal",
  "bg-warn",
] as const;

const PIECE_COUNT = 16;
const FALL_DURATION = 900; // + delay maks 300ms → total ≤ 1200ms (§ 6)
const MAX_DELAY = 300;
const FADE_DURATION = 400; // jalur reduced-motion (fade sederhana, § 6)

type Piece = {
  key: number;
  leftPercent: number;
  colorClass: string;
  size: number;
  delay: number;
  rotation: number;
};

/** Deterministik — komposisi sama di tiap render & platform. */
function buildPieces(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, (_, i) => ({
    key: i,
    leftPercent: (i * 37 + 7) % 94,
    colorClass: COLORS[i % COLORS.length] ?? COLORS[0],
    size: 6 + ((i * 13) % 6),
    delay: (i * 53) % MAX_DELAY,
    rotation: 180 + ((i * 97) % 360),
  }));
}

const PIECES: Piece[] = buildPieces();

function ConfettiPiece({ piece, height, reduced }: { piece: Piece; height: number; reduced: boolean }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      progress.value = withTiming(1, { duration: FADE_DURATION, reduceMotion: ReduceMotion.Never });
      return;
    }
    progress.value = withDelay(
      piece.delay,
      withTiming(1, { duration: FALL_DURATION, easing: Easing.out(Easing.quad) }),
    );
  }, [progress, piece.delay, reduced]);

  const animatedStyle = useAnimatedStyle(() => {
    if (reduced) {
      // Posisi tenang: sebar statis se tinggi area, hanya opacity yang berubah.
      return {
        opacity: progress.value,
        transform: [{ translateY: (height * (piece.key + 1)) / (PIECE_COUNT + 1) }],
      };
    }
    const p = progress.value;
    return {
      opacity: p < 0.15 ? p / 0.15 : p > 0.75 ? (1 - p) / 0.25 : 1,
      transform: [{ translateY: -16 + p * (height + 32) }, { rotate: `${p * piece.rotation}deg` }],
    };
  });

  return (
    <Animated.View
      style={[{ position: "absolute", top: 0, left: `${piece.leftPercent}%` }, animatedStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        className={piece.colorClass}
        style={{ width: piece.size, height: Math.round(piece.size * 1.6), borderRadius: 2 }}
      />
    </Animated.View>
  );
}

/** Overlay konfeti absolut ( isi layar ). Pasang sebagai anak terakhir layar. */
export function ConfettiOverlay() {
  const reduced = useReducedMotion() === true;
  const [height, setHeight] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    setHeight((current) => (current === next ? current : next));
  };

  return (
    <View
      pointerEvents="none"
      onLayout={onLayout}
      className="absolute inset-0"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {height > 0
        ? PIECES.map((piece) => (
            <ConfettiPiece key={piece.key} piece={piece} height={height} reduced={reduced} />
          ))
        : null}
    </View>
  );
}
