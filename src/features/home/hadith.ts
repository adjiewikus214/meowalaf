/**
 * Owner: features/home. "Hadis hari ini" — satu hadis shahih yang berganti tiap
 * hari WIB, tampil di kartu Home (menggantikan "Nasihat Abu", BRAND.md § 5).
 *
 * ⚠️ PERLU REVIEW MANUSIA SEBELUM RILIS PUBLIK (RULES § 7.7).
 * Teks Arab, nama rawi, dan nomor hadis di bawah **wajib** dicocokkan ulang dengan
 * cetakan atau sumber yang kredibel sebelum rilis ke orang luar tim. Skrip
 * tidak boleh memverifikasi kebenaran religi — yang bisa dijaga otomatis
 * hanya *kelengkapan bentuk*: test di `hadith.test.ts` memastikan tiap entri punya
 * matn Arab, kunci terjemahan, dan baris atribusi. Kalau satu nomor hadis salah,
 * tidak ada satu pun test yang akan gagal; itu sebabnya syarat review di atas
 * bukan formalitas.
 *
 * Aturan yang dijaga di sini:
 *   1. Hanya hadis **shahih** yang masuk. Semua dari Bukhari & Muslim; beberapa
 *      dua-duanya (muttafaq 'alaih), yang lebih kuat.
 *   2. Matn **tidak pernah diedit** untuk enak dibaca — bukan diringkas, bukan
 *      dirapikan. Kalau terlalu panjang untuk kartu, itu alasan untuk mengganti
 *      hadis, bukan memotong teksnya (RULES § 7.1, pola yang sama dengan ayat).
 *   3. Atribusi wajib dan melekat pada teks: rawi + collection + nomor. Kutipan
 *      tanpa sumber adalah defect, bukan gaya penulisan.
 *   4. Rotasi deterministik dari tanggal WIB — persis seperti tip yang pernah ada
 *      di sini: hari yang sama selalu memilih entri yang sama, tanpa state.
 *   5. Teks Arab adalah data konten, bukan i18n: satu matn untuk semua locale,
 *      yang berbeda hanya terjemahan dan atribusi (lihat `hadith.N.*`).
 *
 * Kenapa modul ini murni (tanpa React/RN): bisa diuji tanpa stub, dan bisa dipakai
 * test lintas repo.
 */
import type { TranslationKey } from "@/core/i18n";
import { epochDays } from "@/core/time/wib";

export type Hadith = {
  /** Id stabil untuk test & log, bukan untuk ditampilkan ke user. */
  readonly id: string;
  /** Matn Arab — verbatim, tidak diedit. */
  readonly arabic: string;
  /** Kunci terjemahan + baris atribusi di kamus i18n. */
  readonly textKey: TranslationKey;
  readonly attributionKey: TranslationKey;
};

export const HADITHS = [
  {
    id: "niyyah",
    arabic: "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى",
    textKey: "hadith.1.text",
    attributionKey: "hadith.1.attribution",
  },
  {
    id: "adamah",
    arabic: "أَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ",
    textKey: "hadith.2.text",
    attributionKey: "hadith.2.attribution",
  },
  {
    id: "khayrukum",
    arabic: "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ",
    textKey: "hadith.3.text",
    attributionKey: "hadith.3.attribution",
  },
  {
    id: "thariq",
    arabic: "مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ",
    textKey: "hadith.4.text",
    attributionKey: "hadith.4.attribution",
  },
  {
    id: "iqra",
    arabic: "اقْرَؤُوا الْقُرْآنَ فَإِنَّهُ يَأْتِي يَوْمَ الْقِيَامَةِ شَفِيعًا لِأَصْحَابِهِ",
    textKey: "hadith.5.text",
    attributionKey: "hadith.5.attribution",
  },
  {
    id: "kalimah",
    arabic: "الْكَلِمَةُ الطَّيِّبَةُ صَدَقَةٌ",
    textKey: "hadith.6.text",
    attributionKey: "hadith.6.attribution",
  },
] as const satisfies readonly Hadith[];

/** Kunci hadis untuk tanggal WIB (`YYYY-MM-DD`). Input rusak → hadis pertama. */
export function hadithForDay(day: string): Hadith {
  const days = epochDays(day);
  if (days === null) return HADITHS[0];
  const index = ((days % HADITHS.length) + HADITHS.length) % HADITHS.length;
  return HADITHS[index] ?? HADITHS[0];
}