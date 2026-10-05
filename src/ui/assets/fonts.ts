/**
 * Owner: ui/assets. Asset font dibundel statis (dipakai app/_layout.tsx).
 *
 * Hanya empat font yang benar-benar dirender:
 *   - Amiri-Regular      -> `font-arab`, teks mushaf
 *   - Poppins-Regular    -> `--font-sans`, body
 *   - Poppins-Bold       -> `--font-display`, judul & angka besar
 *   - NotoSans-Regular   -> `--font-translit`, **hanya** untuk kata
 *     ber-transliterasi Arab (Ḥ ṣ Ṭ ẓ + macron + ʻ). Poppins tidak punya glyph
 *     itu, dan terjemahan ayat memakainya di ratusan ayat — tanpa fallback ini,
 *     "Subḥānallāhumma" jadi campuran dua typeface di tengah kalimat.
 *
 * Weight lain sengaja tidak disertakan: tidak ada satu pun `font-weight`/
 * `font-bold` di app, jadi hanya menambah byte startup tanpa pernah dipakai
 * (docs/PERF.md).
 *
 * File .ttf di folder ini adalah hasil subset — glyph yang tidak pernah dirender
 * sudah dibuang (file transliterasi cuma berisi 12 glyph yang benar-benar muncul
 * di teks app - bukan Latin penuh). Aslinya ada di ./fonts/_source, dibangun ulang dengan
 * `npm run fonts:subset`. Jangan menambah font baru tanpa menambahkannya ke
 * scripts/fonts/glyphs.mjs, kalau tidak akan hilang saat subset berikutnya.
 */
import AmiriRegular from "./fonts/Amiri-Regular.ttf";
import NotoSansRegular from "./fonts/NotoSans-Regular.ttf";
import PoppinsBold from "./fonts/Poppins-Bold.ttf";
import PoppinsRegular from "./fonts/Poppins-Regular.ttf";

export { AmiriRegular, NotoSansRegular, PoppinsBold, PoppinsRegular };