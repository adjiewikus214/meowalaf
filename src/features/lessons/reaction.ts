/**
 * Owner: features/lessons. Reaksi maskot Abu saat latihan (BRAND.md § 5) — PURE.
 *
 * Kenapa di features, bukan di komponen: ini ATURAN (mood + kalimat mana yang
 * muncul), bukan tampilan. Dengan dipisah, aturannya bisa diuji tanpa React,
 * dan nada copy-nya bisa dibaca sekaligus — penting karena audiensnya pemula
 * (mualaf): kalimat yang menghakimi itu bug, bukan sekadar selera.
 *
 * Garis nada yang dipegang (RULES § 7.9):
 *   - **salah → tidak pernah menghukum.** Abu tetap melihat user dengan mata
 *     terbuka (`encourage`), bukan wajah sedih/marah, dan kalimatnya menormalkan
 *     kesalahan sebagai bagian dari belajar.
 *   - **benar dengan hint tetap dihargai** (mood `happy`), karena pemula yang
 *     memakai bantuan itu sedang belajar, bukan curang.
 *   - kalimat dipilih bergilir dari `position` soal, jadi dua soal berturut-turut
 *     tidak mengulang kalimat yang sama tanpa perlu state apa pun.
 */
import type { TranslationKey } from "@/core/i18n";
import type { CatMood } from "@/ui/components";

export type LessonReactionInput = {
  verdict: "correct" | "wrong";
  /** Posisi soal 1-based (`LessonView.position`, termasuk soal ulangan). */
  position: number;
  /** true bila ini percobaan kedua dari retry queue. */
  isRetry: boolean;
  /** Hint dipakai untuk soal ini (eliminasi opsi / potongan dibantu). */
  hintUsed: boolean;
};

export type LessonReaction = {
  mood: CatMood;
  /** Kalimat Abu untuk momen ini — sudah terlokalisasi lewat kamus. */
  lineKey: TranslationKey;
};

export const ABU_CHEER_KEYS = ["abu.cheer.1", "abu.cheer.2"] as const satisfies readonly TranslationKey[];
export const ABU_ENCOURAGE_KEYS = [
  "abu.encourage.1",
  "abu.encourage.2",
  "abu.encourage.3",
] as const satisfies readonly TranslationKey[];
export const ABU_RETRY_KEY = "abu.retry.1" as const satisfies TranslationKey;

/** Pilih satu kalimat dari daftar, bergilir menurut posisi soal. */
function pick(keys: readonly TranslationKey[], position: number): TranslationKey {
  const length = keys.length;
  const index = (((position - 1) % length) + length) % length;
  return keys[index] ?? keys[0]!;
}

export function lessonReaction({ verdict, position, isRetry, hintUsed }: LessonReactionInput): LessonReaction {
  if (verdict === "wrong") {
    return {
      mood: "encourage",
      lineKey: isRetry ? ABU_RETRY_KEY : pick(ABU_ENCOURAGE_KEYS, position),
    };
  }
  return {
    mood: hintUsed ? "happy" : "cheer",
    lineKey: pick(ABU_CHEER_KEYS, position),
  };
}
