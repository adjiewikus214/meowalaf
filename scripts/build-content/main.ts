/**
 * Entry pipeline konten Ayatin: fetch → validate → emit.
 * Jalankan: npm run content:build (pakai cache) atau npm run content:fetch (refresh).
 */
import { AYAH_COUNTS } from "./ayah-counts";
import { fetchSurahFull, fetchSurahMetadata } from "./fetch";
import { emitBundle } from "./emit";
import { validateAll } from "./validate";
import type { UthmaniRaw } from "./validate";

async function main(): Promise<void> {
  const force = process.argv.includes("--fetch");
  if (force) {
    const { rmSync } = await import("node:fs");
    try {
      rmSync(".content-cache", { recursive: true, force: true });
    } catch {
      // cache tidak ada — tidak masalah
    }
  }

  console.log("▶ 1/3 fetch metadata 114 surah...");
  const metas = await fetchSurahMetadata();
  if (metas.length !== 114) {
    throw new Error(`Metadata surah: ${metas.length}/114 — pipeline berhenti`);
  }

  console.log("▶ 2/3 fetch teks Arab + terjemahan (114 surah)...");
  const arabic: UthmaniRaw[] = [];
  const translations = [];
  const metasFull = [];
  for (let surahId = 1; surahId <= 114; surahId++) {
    const full = await fetchSurahFull(surahId);
    arabic.push({ surahId, texts: full.arabic });
    translations.push({ surahId, texts: full.translation });
    metasFull.push(full.meta);
    if (surahId % 10 === 0) {
      console.log(`   ... ${surahId}/114 surah`);
    }
  }

  console.log("▶ 3/3 validasi...");
  const { surahs, issues } = validateAll(metasFull, arabic, translations);
  if (issues.length > 0) {
    console.error(`✖ ${issues.length} masalah ditemukan (gagal, tidak ada emit):`);
    for (const issue of issues.slice(0, 20)) {
      console.error(`  - surah ${issue.surahId}: ${issue.problem}`);
    }
    if (issues.length > 20) console.error(`  ... dan ${issues.length - 20} lagi`);
    process.exit(1);
  }

  const manifest = await emitBundle(surahs);
  console.log(
    `✔ bundle selesai: ${manifest.surahCount} surah, ${manifest.ayahCount} ayat → src/data/content/`,
  );
  const totalStandard = AYAH_COUNTS.reduce((a, b) => a + b, 0);
  if (manifest.ayahCount !== totalStandard) {
    throw new Error(`Total ayat bundle ${manifest.ayahCount} ≠ standar ${totalStandard}`);
  }
}

main().catch((err: unknown) => {
  console.error("✖ pipeline gagal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
