/**
 * Owner: ui. **Fallback font untuk kata ber-transliterasi Arab.**
 *
 * Poppins (body + judul) tidak punya huruf ber-titik (Ḥ ḣ ṡ Ṣ ṣ Ṭ ṭ ẓ), tanda
 * penghubung seperti macron, maupun ʻ ("Syuʻbaib", "ʻArasy") — sementara
 * terjemahan ayat memakainya di 32 ayat pada 27 surah ("Subḥānallāhumma",
 * "Wusṭā", "baḥi̓rah"). Tanpa fallback,
 * huruf-huruf itu diambil dari font sistem **di tengah kalimat**: satu baris
 * terjemahan jadi campuran dua typeface yang jelas berbeda.
 *
 * Solusinya: font fallback kecil khusus (Noto Sans Regular, hanya **2,1 KB gzip**
 * berisi 12 glyph — lihat `scripts/fonts/glyphs.mjs`) yang dipasang per **kata**,
 * lewat `--font-translit` + `TransliteratedText`.
 *
 * Kenapa per kata, bukan per ayat: kalau satu ayat pindah font, baris itu melompat
 * dari Poppins ke Noto Sans dan sebaliknya antar baris — jauh lebih noticeable
 * daripada satu kata yang membedakannya.
 *
 * Modul ini murni (tanpa React/RN) supaya bisa diuji tanpa stub, dan bisa dipakai
 * test lintas repo: `scripts/fonts/transliteration-font.test.ts` memverifikasi
 * bahwa setiap karakter yang dianggap "butuh fallback" memang **tidak ada** di
 * Poppins dan **ada** di Noto Sans — jadi daftar ini tidak bisa basi diam-diam
 * kalau font-nya diganti.
 */

/**
 * Karakter yang Poppins tidak punya tapi transliterasi Arab butuh: ʻ (turned
 * comma), Combining Diacritical Marks, dan Latin Extended Additional.
 *
 * Sengaja tidak lebih luas: `ā` (U+0101) memang ada di Poppins, jadi tidak
 * perlu fallback — kalau ikut dicakup, kata biasa seperti "al-ākhira" akan
 * dibungkus font yang tidak dibutuhkan.
 */
// `no-misleading-character-class` dimatikan khusus di sini: rentang U+0300-036F
// memang Combining Diacritical Marks, dan kita justru MEMBUTUHKAN pola ini untuk
// menangkap macron pada transliterasi. Pola ini hanya dipakai `.test()` untuk
// satu karakter pada satu waktu — tidak pernah dipakai menghitung panjang string,
// jadi risikonya (huruf menempel ke tanda) tidak ada di sini.
// eslint-disable-next-line no-misleading-character-class
const TRANSLITERATION_PATTERN = /[\u02bb\u0300-\u036f\u1e00-\u1eff]/;

export type TransliterationToken = {
  text: string;
  /** true = kata ini memakai glyph yang harus ambil font fallback. */
  fallback: boolean;
};

/** Apakah teks ini memuat karakter yang Poppins tidak punya? */
export function needsTransliterationFont(text: string): boolean {
  return TRANSLITERATION_PATTERN.test(text);
}

/**
 * Pecah teks menjadi kata (spasi dipertahankan) + penanda apakah kata itu perlu
 * fallback. `tokens.map(t => t.text).join("")` selalu sama dengan `text` — itu
 * dijaga test, karena teks mushaf tidak boleh berubah sedikit pun di jalan.
 */
export function transliterationTokens(text: string): TransliterationToken[] {
  // `split` dengan grup tangkap: spasi ikut jadi token supaya teks asli utuh.
  return text
    .split(/(\s+)/)
    .filter((token) => token.length > 0)
    .map((token) => ({ text: token, fallback: /^\s+$/.test(token) ? false : needsTransliterationFont(token) }));
}