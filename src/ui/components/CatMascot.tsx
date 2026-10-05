/**
 * Owner: ui/components. Maskot Meowalaf: **Abu** — kucing British Shorthair
 * abu-abu yang duduk memeluk mushaf kecil, memakai peci (BRAND.md § 2–4).
 *
 * Kenapa SVG (`react-native-svg`), bukan susunan `View` seperti versi pertama:
 * versi View tidak bisa menggambar kurva, jadi mata senyum, ekor melengkung,
 * dan kitab terbuka semuanya jatuh ke bentuk kotak — hasilnya terbaca seperti
 * hamster, bukan kucing (masukan nyata dari pemilik produk). `react-native-svg`
 * adalah modul bawaan Expo Go, dan biayanya di bundle web diukur di PERF.md.
 *
 * **Komponen ini tidak menggambar apa pun sendiri.** Seluruh art tinggal di
 * `src/ui/cat-art.ts` (`catScene()`); di sini hanya dua pekerjaan:
 *   1. memetakan layer → elemen SVG, dan
 *   2. memasang animasi per layer (`id`): ekor berayun, badan bernapas, mata
 *      berkedip, tangan melambai, plus animasi masuk satu kali.
 * Art yang sama dipakai `scripts/brand/mascot-preview.ts` untuk pratinjau semua
 * pose, jadi pratinjau tidak mungkin menyimpang dari yang dilihat user.
 *
 * Animasi dijalankan di `Animated.View` pembungkus (bukan prop SVG), karena
 * transform `View` jalan sama di native & web; `transformOrigin` dari layer
 * membuat ekor berayun dari pangkalnya dan mata berkedip dari garis matanya.
 * Hormat reduced-motion (`useReducedMotion`): tanpa gerak sama sekali, maskot
 * langsung berdiri di posisi netral — termasuk animasi masuk yang dilewati.
 * Sapaan `entrance="walk"` juga hanya berjalan **sekali per sesi app**: layar
 * yang di-render ulang (mis. oleh navigator) tidak mengulanginya.
 *
 * Adab (RULES § 7.9, BRAND.md § 6): maskot hanya muncul di meta-experience
 * (onboarding, kartu sapaan, empty state, badge streak, hasil lesson) — TIDAK
 * pernah di dalam/di samping blok ayat, nama surah, atau metadata mushaf.
 * Peci di sini keputusan produk (RULES § 7.9 diperbarui), dan kucingnya TIDAK
 * meniru gerakan ibadah: ia duduk, memeluk kitab, melambai, dan tersenyum.
 */
import { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

import {
  CAT_MOTION,
  catScene,
  type CatEntrance,
  type CatLayer,
  type CatMood,
  type CatPrimitive,
  type CatVariant,
  type CatPose,
} from "../cat-art";

export type { CatEntrance, CatMood, CatPose, CatVariant } from "../cat-art";

export type CatMascotProps = {
  /** Sisi kotak maskot dalam px (default 96). */
  size?: number;
  mood?: CatMood;
  /** `ash` = Abu (BSH abu-abu), `cream` = kucing putih. */
  variant?: CatVariant;
  /** `sit` = duduk memeluk kitab (default), `wave` = duduk sambil melambai. */
  pose?: CatPose;
  /** Animasi masuk satu kali saat mount: `walk` = berjalan masuk dari kiri. */
  entrance?: CatEntrance;
  /** Bulan sabit + bintang kecil di sudut kanan atas. */
  showMoon?: boolean;
  /** Napas, ekor, kedip & lambaian (default aktif; hormat reduced-motion). */
  animate?: boolean;
  /** Kalau diisi, maskot diumumkan ke screen reader sebagai gambar berlabel. */
  label?: string;
  /** Hook harness performa (RULES § 9). */
  testID?: string;
};

/** Ruang koordinat gambar — sama dengan `cat-art.ts` (peta 200×200). */
const ART = 200;

/**
 * Sapaan "berjalan masuk" hanya SEKALI per sesi app.
 *
 * Kenapa bukan state React: tujuannya justru bertahan melewati remount. Layar
 * bisa di-render ulang oleh navigator (atau root layout yang re-render), dan
 * tanpa ini Abu berjalan masuk berulang-ulang di layar yang sama — gerakan yang
 * dimaksudkan sebagai sapaan berubah jadi kedutan. Di native, satu sesi = satu
 * proses app; di web, satu sesi = sekali muat halaman (muat ulang halaman =
 * sapaan lagi, dan itu memang benar).
 */
let greeted = false;

export function CatMascot({
  size = 96,
  mood = "idle",
  variant = "ash",
  pose = "sit",
  entrance = "none",
  showMoon = false,
  animate = true,
  label,
  testID,
}: CatMascotProps) {
  const reduced = useReducedMotion() === true;
  const moving = animate && !reduced;
  const layers = catScene({ mood, variant, pose, showMoon });
  // Kedip hanya masuk akal kalau layer mata memang bermata terbuka (idle/encourage).
  const blinkable = layers.some((layer) => layer.id === "eyes" && layer.blinkable);
  const walking = entrance === "walk";

  const tail = useSharedValue(0);
  const breathe = useSharedValue(0);
  const blink = useSharedValue(0);
  const wave = useSharedValue(0);
  // Mulai dari luar kotak HANYA kalau sapaan ini yang memutarnya; kalau tidak,
  // langsung di tempat (tidak ada kerlip opasitas 0 satu frame saat remount).
  const step = useSharedValue(walking && moving && !greeted ? 0 : 1);

  useEffect(() => {
    if (!moving) {
      tail.value = 0;
      breathe.value = 0;
      blink.value = 0;
      wave.value = 0;
      step.value = 1;
      return;
    }

    // `cheer` = momen selesai lesson, jadi napas & ekor lebih hidup.
    const lively = mood === "cheer";
    tail.value = withRepeat(
      withTiming(1, {
        duration: lively ? CAT_MOTION.cheerTailMs : CAT_MOTION.tailMs,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
    breathe.value = withRepeat(
      withTiming(1, {
        duration: lively ? CAT_MOTION.cheerBreatheMs : CAT_MOTION.breatheMs,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );

    if (pose === "wave") {
      wave.value = withRepeat(
        withTiming(1, { duration: CAT_MOTION.waveMs, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    } else {
      wave.value = 0;
    }

    if (blinkable) {
      // Urutan yang sama tiap siklus (deterministik, tanpa Math.random) supaya
      // gerakannya bisa diuji & direproduksi: jeda tenang → tutup → buka.
      blink.value = 0;
      blink.value = withRepeat(
        withSequence(
          withDelay(
            CAT_MOTION.blinkPauseMs,
            withTiming(1, { duration: CAT_MOTION.blinkCloseMs, easing: Easing.in(Easing.quad) }),
          ),
          withTiming(0, { duration: CAT_MOTION.blinkOpenMs, easing: Easing.out(Easing.quad) }),
        ),
        -1,
        false,
      );
    } else {
      blink.value = 0;
    }

    if (walking && !greeted) {
      greeted = true;
      step.value = 0;
      step.value = withTiming(1, { duration: CAT_MOTION.walkMs, easing: Easing.out(Easing.cubic) });
    } else {
      // Sudah pernah menyapa di sesi ini (atau memang tidak diminta): langsung di tempat.
      step.value = 1;
    }
  }, [moving, mood, pose, blinkable, walking, tail, breathe, blink, wave, step]);

  const tailStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-CAT_MOTION.tailSwingDeg / 2 + tail.value * CAT_MOTION.tailSwingDeg}deg` }],
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -1.8 * breathe.value }, { scaleY: 1 + 0.018 * breathe.value }],
  }));
  const eyesStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: 1 - CAT_MOTION.blinkSquash * blink.value }],
  }));
  const waveStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-CAT_MOTION.waveSwingDeg / 2 + wave.value * CAT_MOTION.waveSwingDeg}deg` }],
  }));
  // Berjalan masuk: geser dari kiri + dua langkah kecil (busur `|sin|`) + pudar.
  const stepStyle = useAnimatedStyle(() => ({
    opacity: step.value,
    transform: [
      { translateX: -(1 - step.value) * size * CAT_MOTION.walkShift },
      { translateY: -CAT_MOTION.walkHop * Math.abs(Math.sin(2 * Math.PI * step.value)) },
    ],
  }));

  // Tiap layer punya animasi sendiri; `catScene` yang menentukan layer mana ada.
  const styleByLayer = {
    tail: tailStyle,
    body: bodyStyle,
    eyes: eyesStyle,
    wave: waveStyle,
  } satisfies Record<CatLayer["id"], unknown>;

  return (
    <Animated.View
      testID={testID}
      style={[{ width: size, height: size }, stepStyle]}
      accessibilityRole={label !== undefined ? "image" : undefined}
      accessibilityLabel={label}
      accessibilityElementsHidden={label === undefined}
      importantForAccessibility={label === undefined ? "no-hide-descendants" : "auto"}
    >
      {layers.map((layer) => (
        <Animated.View
          key={layer.id}
          style={[
            {
              position: "absolute",
              width: size,
              height: size,
              transformOrigin: `${layer.origin.x}% ${layer.origin.y}%`,
            },
            styleByLayer[layer.id],
          ]}
        >
          <Svg width={size} height={size} viewBox={`0 0 ${ART} ${ART}`}>
            {layer.primitives.map((primitive, index) => (
              <Primitive key={`${layer.id}-${index}`} primitive={primitive} />
            ))}
          </Svg>
        </Animated.View>
      ))}
    </Animated.View>
  );
}

/** Satu elemen gambar dari `cat-art.ts`. Path tanpa `fill` = garis (stroke). */
function Primitive({ primitive }: { primitive: CatPrimitive }) {
  switch (primitive.kind) {
    case "path":
      return (
        <Path
          d={primitive.d}
          fill={primitive.fill ?? "none"}
          stroke={primitive.stroke}
          strokeWidth={primitive.strokeWidth}
          strokeLinecap={primitive.strokeLinecap}
          opacity={primitive.opacity}
        />
      );
    case "ellipse":
      return (
        <Ellipse
          cx={primitive.cx}
          cy={primitive.cy}
          rx={primitive.rx}
          ry={primitive.ry}
          fill={primitive.fill}
          opacity={primitive.opacity}
        />
      );
    case "circle":
      return <Circle cx={primitive.cx} cy={primitive.cy} r={primitive.r} fill={primitive.fill} opacity={primitive.opacity} />;
    case "rect":
      return (
        <Rect x={primitive.x} y={primitive.y} width={primitive.width} height={primitive.height} rx={primitive.rx} fill={primitive.fill} />
      );
  }
}
