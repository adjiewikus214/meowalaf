/**
 * Owner: ui/components. Jejak kaki kucing (1 pad besar + 4 jari) — pengganti api
 * 🔥 di badge streak (BRAND.md § 4). Digambar dari View dengan alasan yang sama
 * dengan CatMascot: tanpa dependency SVG, tanpa byte baru, warna dari token.
 *
 * Emoji jejak kaki sengaja TIDAK dipakai: bentuknya berbeda-beda per platform
 * (dan di Windows berwarna pink), jadi badge streak akan terlihat beda tiap
 * device. Catatan: karakter di komentar ikut terhitung sebagai inventaris
 * glyph (scripts/fonts/glyphs.mjs), jadi jangan menempel emoji di komentar.
 */
import { View } from "react-native";

export type CatPawTone = "flame" | "emerald" | "gold" | "ash";

export type CatPawProps = {
  /** Sisi kotak jejak dalam px (default 16). */
  size?: number;
  tone?: CatPawTone;
  label?: string;
  /** Hook harness performa (RULES § 9). */
  testID?: string;
};

const TONE: Record<CatPawTone, string> = {
  flame: "bg-flame",
  emerald: "bg-brand-emerald",
  gold: "bg-gold",
  ash: "bg-cat-ash",
};

/** Posisi jari (relatif 100×100) — busur khas jejak kaki kucing. */
const TOES = [
  { left: 1, top: 26, rotate: "-20deg" },
  { left: 25, top: 8, rotate: "-7deg" },
  { left: 55, top: 8, rotate: "7deg" },
  { left: 79, top: 26, rotate: "20deg" },
] as const;

export function CatPaw({ size = 16, tone = "flame", label, testID }: CatPawProps) {
  const px = (n: number) => n * (size / 100);
  return (
    <View
      testID={testID}
      style={{ width: size, height: size }}
      accessibilityRole={label !== undefined ? "image" : undefined}
      accessibilityLabel={label}
      accessibilityElementsHidden={label === undefined}
      importantForAccessibility={label === undefined ? "no-hide-descendants" : "auto"}
    >
      <View className={`${TONE[tone]} absolute`} style={{ left: px(23), top: px(48), width: px(54), height: px(44), borderRadius: px(20) }} />
      {TOES.map((toe) => (
        <View
          key={toe.left}
          className={`${TONE[tone]} absolute`}
          style={{
            left: px(toe.left),
            top: px(toe.top),
            width: px(20),
            height: px(25),
            borderRadius: px(11),
            transform: [{ rotate: toe.rotate }],
          }}
        />
      ))}
    </View>
  );
}
