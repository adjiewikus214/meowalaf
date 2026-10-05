/**
 * Sumber data konten (ARCHITECTURE.md § 6): equran.id — Kemenag open data.
 * Satu sumber untuk metadata surah, teks Arab, terjemahan Indonesia, dan audio CDN.
 * Atribusi wajib tampil di layar About (RULES.md § 7.6).
 */
export const EQURAN = {
  list: "https://equran.id/api/v2/surat",
  detail: (surahId: number) => `https://equran.id/api/v2/surat/${surahId}`,
} as const;

export type Reciter = {
  id: string;
  name: string;
  /** URL base; URL ayat: `${baseUrl}/${sss}${aaa}.mp3` (surah & ayat 3-digit) */
  baseUrl: string;
};

/** Qari audio per ayat dari CDN equran.id (key audio "01".."06" di API). */
export const RECITERS: readonly Reciter[] = [
  {
    id: "juhany",
    name: "Abdullah Al-Juhany",
    baseUrl: "https://cdn.equran.id/audio-partial/Abdullah-Al-Juhany",
  },
  {
    id: "muhsin",
    name: "Abdul Muhsin Al-Qasim",
    baseUrl: "https://cdn.equran.id/audio-partial/Abdul-Muhsin-Al-Qasim",
  },
  {
    id: "sudais",
    name: "Abdurrahman as-Sudais",
    baseUrl: "https://cdn.equran.id/audio-partial/Abdurrahman-as-Sudais",
  },
  {
    id: "dossari",
    name: "Ibrahim Al-Dossari",
    baseUrl: "https://cdn.equran.id/audio-partial/Ibrahim-Al-Dossari",
  },
  {
    id: "afasy",
    name: "Misyari Rasyid Al-Afasy",
    baseUrl: "https://cdn.equran.id/audio-partial/Misyari-Rasyid-Al-Afasi",
  },
  {
    id: "yasser",
    name: "Yasser Al-Dosari",
    baseUrl: "https://cdn.equran.id/audio-partial/Yasser-Al-Dosari",
  },
];

export const ATTRIBUTIONS: readonly string[] = [
  "Teks Al-Quran, terjemahan Indonesia, dan metadata surah: Kementerian Agama RI via equran.id (open data)",
  "Audio murottal per ayat: cdn.equran.id",
  ...RECITERS.map((r) => `Qari: ${r.name}`),
];
