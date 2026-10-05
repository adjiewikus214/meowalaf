/**
 * Owner: ui/components. Teks Latin dengan fallback transliterasi per kata
 * (lihat `src/ui/transliteration.ts` untuk alasannya).
 *
 * Dipakai di mana pun **terjemahan ayat** dirender: blok ayat, panel materi,
 * baris terjemahan di kartu soal, kalimat penjelasan, dan opsi jawaban Latin.
 * Penulisannya sengaja ada di komponen/pemanggil teks, bukan di setiap baris
 * manual: kalau berasal dari terjemahan ayat, karakter ṣ/ṭ/ẓ akan muncul
 * tiba-tiba dan tidak ada yang ingat memasang font-nya.
 *
 * Bentuk DOM-nya sengaja minimum: teks tanpa karakter transliterasi dirender
 * persis seperti biasa (satu `<Text>` berisi string), jadi jalur yang paling
 * sering dipakai tidak menambah node sama sekali.
 */
import { Text } from "react-native";

import { needsTransliterationFont, transliterationTokens } from "../transliteration";

export type TransliteratedTextProps = {
  text: string;
  /** Class parent (warna, ukuran, leading) diteruskan ke `<Text>` terluar. */
  className?: string;
};

/** Kelas fallback; satu-satunya tempat nama token font ini disebut di kode. */
const FALLBACK_CLASS = "font-translit";

export function TransliteratedText({ text, className }: TransliteratedTextProps) {
  if (!needsTransliterationFont(text)) {
    return <Text className={className}>{text}</Text>;
  }
  return (
    <Text className={className}>
      {transliterationTokens(text).map((token, index) =>
        token.fallback ? (
          <Text key={`${index}-${token.text}`} className={FALLBACK_CLASS}>
            {token.text}
          </Text>
        ) : (
          token.text
        ),
      )}
    </Text>
  );
}