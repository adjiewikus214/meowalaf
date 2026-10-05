/**
 * Entry pipeline word-data (ADR-005 Langkah 2): fetch MCP → validate → emit.
 * Jalankan: `npm run content:word-data`. Fail-soft sesuai ADR-005: kegagalan MCP
 * pada satu surah tidak menghentikan surah lain; kegagalan validasi = tidak ada emit.
 */
import { getSurahAyahs } from "../../src/core/content/loader";
import { getSurahMeta } from "../../src/core/content/meta";
import { McpClient } from "./mcp-client";
import { emitWordData } from "./emit-word-data";
import { createWordDataClient, extractAyahRoots, type WordRootToken } from "./word-data";
import { validateWordData, WORD_DATA_SURAH_IDS, type SurahWordInput } from "./word-validate";

const FETCH_MORPH_SURAH_IDS: readonly number[] = [1]; // morfologi: hanya Al-Fatihah (probe ADR-005)

async function main(): Promise<void> {
  const client = createWordDataClient(new McpClient({ timeoutMs: 25_000, retries: 2 }));
  console.log(`▶ word-data MCP: ${WORD_DATA_SURAH_IDS.length} surah (Al-Fatihah + Juz 30)`);

  const inputs: SurahWordInput[] = [];
  const rootsBySurah: Record<number, Record<string, WordRootToken[]>> = {};
  let fetchFailures = 0;

  for (const surahId of WORD_DATA_SURAH_IDS) {
    const meta = getSurahMeta(surahId);
    const coreAyahs = getSurahAyahs(surahId).map((a) => ({ ayahNumber: a.ayahNumber, arabic: a.arabic }));
    try {
      const surah = await client.fetchSurahWords(surahId);
      inputs.push({ surahId, meta, coreAyahs, surah });
    } catch (error) {
      fetchFailures += 1;
      console.warn(`⚠ surah ${surahId}: fetch MCP gagal (${error instanceof Error ? error.message : String(error)})`);
      inputs.push({ surahId, meta, coreAyahs, surah: undefined });
    }
    if (surahId % 10 === 0) console.log(`   ... ${surahId} selesai`);
  }

  for (const surahId of FETCH_MORPH_SURAH_IDS) {
    const meta = getSurahMeta(surahId);
    if (meta === undefined) continue;
    const byAyah: Record<string, WordRootToken[]> = {};
    let morphOk = true;
    for (let ayahNumber = 1; ayahNumber <= meta.ayahCount; ayahNumber++) {
      try {
        const morph = await client.fetchAyahMorphology(surahId, ayahNumber);
        byAyah[String(ayahNumber)] = extractAyahRoots(morph);
      } catch (error) {
        morphOk = false;
        console.warn(`⚠ morfologi ${surahId}:${ayahNumber} gagal (${error instanceof Error ? error.message : String(error)})`);
        break;
      }
    }
    if (morphOk) rootsBySurah[surahId] = byAyah;
  }

  console.log("▶ validasi word-data...");
  const validated = validateWordData(inputs, rootsBySurah);
  if (validated.issues.length > 0) {
    console.error(`✖ ${validated.issues.length} masalah word-data (gagal, tidak ada emit):`);
    for (const issue of validated.issues.slice(0, 20)) {
      console.error(`  - surah ${issue.surahId}: ${issue.problem}`);
    }
    if (validated.issues.length > 20) console.error(`  ... dan ${validated.issues.length - 20} lagi`);
    process.exit(1);
  }
  if (validated.warnings.length > 0) {
    console.warn(`⚠ ${validated.warnings.length} perbedaan jumlah token antar digitalisasi (varian ortografi — konten tervalidasi sama):`);
    for (const w of validated.warnings.slice(0, 8)) console.warn(`  - ${w}`);
    if (validated.warnings.length > 8) console.warn(`  ... dan ${validated.warnings.length - 8} lagi`);
  }
  if (fetchFailures > 0) {
    console.error(`✖ ${fetchFailures} surah gagal di-fetch — tidak ada emit (fail-soft, jalankan ulang nanti)`);
    process.exit(1);
  }

  const surahCount = Object.keys(validated.words).length;
  const tokenCount = Object.values(validated.words).reduce(
    (acc, ayahs) => acc + Object.values(ayahs).reduce((n, toks) => n + toks.length, 0),
    0,
  );
  await emitWordData(validated, WORD_DATA_SURAH_IDS);
  console.log(`✔ emit ${surahCount} surah, ${tokenCount} token kata → src/data/content/word-data-juz30.json`);
}

main().catch((error: unknown) => {
  console.error(`✖ Pipeline word-data gagal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
