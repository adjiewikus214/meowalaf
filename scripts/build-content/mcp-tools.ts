/**
 * Owner: scripts/build-content. Satu-satunya tempat yang mem-pin nama tool &
 * URL QuranHub MCP (ADR-005) — nama tool hasil `tools/list` ternyata turunan
 * OpenAPI dan BERBEDA dari tabel di docs, jadi jangan ambil dari docs.
 * Bila server mengubah nama, `npm run content:mcp-check` akan mendeteksinya.
 */

export const DEFAULT_MCP_URL = "https://api.qurani.ai/gw/mcp";

/** URL gateway MCP — bisa dioverride lewat env `MCP_URL` (mis. untuk proxy lokal). */
export function resolveMcpUrl(env: NodeJS.ProcessEnv = process.env): string {
  const override = env["MCP_URL"];
  return override !== undefined && override !== "" ? override : DEFAULT_MCP_URL;
}

/** Nama tool ter-pin (hasil probe tools/list 2026-10-01, lihat ADR-005). */
export const MCP_TOOLS = {
  /** Satu ayat, satu edisi — smoke test & cross-check teks. */
  getAyahByEdition:
    "get_ayah_by_number_or_number_in_surah_and_edition_v1_ayah_reference_editionidentifier_get",
  /** Satu ayat, edisi default. */
  getAyah: "get_ayah_by_number_or_number_in_surah_v1_ayah_reference_get",
  /** Satu surah penuh pada satu edisi — mendukung `words` (word-data, Langkah 2). */
  getSurahByEdition:
    "get_a_surah_by_number_and_edition_v1_surah_surahnumber_editionidentifier_get",
  /** Daftar 114 surah + metadata. */
  getSurahsList: "get_surahs_in_quran_v1_surah_get",
  /** Semua edisi (filter format/language/type) — cross-check terjemahan. */
  getAllEditions: "get_all_available_editions_v1_edition_get",
  /** Edisi audio per qari (narrator identifier). */
  getAudioEditionsByNarrator:
    "get_all_available_audio_editions_by_narrator_identifier_v1_edition_audio_narrator_narratoridentifier_get",
  /** Morfologi per ayat (root/kategori/arti) — word-data, Langkah 2 ADR-005. */
  getAyahMorphology:
    "get_ayah_morphological_analysis_v1_morphology_ayah_reference_get",
  /** Morfologi per kata (lokasi "surah:ayah:word"). */
  getWordMorphology: "get_word_morphological_analysis_v1_morphology_word_location_get",
  /** Cari kata berdasar akar Arab. */
  searchWordsByRoot: "search_words_by_arabic_root_v1_morphology_roots_root_get",
  /** Ayat mirip (Hafs) — kandidat distractor T3 (backlog). */
  getSimilarAyahsHafs: "get_similar_ayahs_for_ayah_hafs_v1_similar_ayah_surahnumber_ayahnumber_get",
  /** Frasa mutashabihat (Hafs) — kandidat distractor T3 (backlog). */
  getMutashabihatHafs:
    "get_mutashabihat_phrases_for_ayah_hafs_v1_mutashabihat_surahnumber_ayahnumber_get",
} as const;

export type McpToolKey = keyof typeof MCP_TOOLS;
