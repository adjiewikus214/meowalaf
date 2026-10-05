/**
 * Entry pipeline word-gloss (ADR-006): baca file QUL dari .content-cache → validasi
 * 3 langkah ADR-006 → emit. Jalankan: `npm run content:word-gloss`. Tanpa jaringan:
 * sumber data = file yang diunduh manual (butuh akun gratis QUL) dan ditaruh di
 * .content-cache/. Fail-fast bila file tidak ditemukan atau validasi gagal.
 */
import { emitWordGloss } from "./emit-word-gloss";
import { readLicenseNotes, scanContentCache } from "./word-gloss";
import { GLOSS_SURAH_IDS, validateGlossData } from "./word-gloss-validate";
import { WORD_DATA_FILE } from "./emit-word-data";
import type { WordToken } from "./word-data";

/** Muat token per ayat dari bundle word-data hasil pipeline ADR-005. */
async function loadWordDataTokens(): Promise<Record<string, Record<string, WordToken[]>>> {
  const { promises: fs } = await import("node:fs");
  const path = await import("node:path");
  const file = path.resolve(process.cwd(), "src/data/content", WORD_DATA_FILE);
  const raw = JSON.parse(await fs.readFile(file, "utf8")) as {
    words: Record<string, Record<string, WordToken[]>>;
  };
  return raw.words;
}

async function main(): Promise<void> {
  console.log(`▶ word-gloss QUL: ${GLOSS_SURAH_IDS.length} surah (Al-Fatihah + Juz 30), sumber = .content-cache/`);

  const words = await loadWordDataTokens();

  const candidates = await scanContentCache();
  if (candidates.length === 0) {
    console.error("✖ Tidak ada file glos QUL di .content-cache/.");
    console.error("  Unduh JSON dari https://qul.tarteel.ai/resources/translation/96 (butuh akun gratis),");
    console.error("  lalu taruh file .json apa adanya di .content-cache/ dan jalankan ulang perintah ini.");
    process.exit(1);
  }
  const best = candidates[0]!;
  console.log(
    `▶ kandidat: ${best.file}${best.from ? ` (properti "${best.from}")` : ""} — ${Object.keys(best.glosses).length.toLocaleString("id-ID")} lokasi kata`,
  );
  for (const other of candidates.slice(1, 4)) {
    console.log(`  · kandidat lain: ${other.file} (${Object.keys(other.glosses).length} lokasi)`);
  }

  const licenseNotes = await readLicenseNotes();
  for (const note of licenseNotes) {
    console.log(`▶ catatan lisensi: ${note.file}`);
  }

  console.log("▶ validasi 3 langkah ADR-006...");
  const validated = validateGlossData(
    { glosses: best.glosses, licenseNotes, sourceFile: best.file },
    { tokensBySurah: words },
  );

  console.log("▶ langkah 2 — sampel struktur (glos QUL vs token word-data):");
  for (const sample of validated.samples) {
    const pct = sample.tokenCount === 0 ? 0 : Math.round((sample.matched / sample.tokenCount) * 100);
    console.log(
      `  - ${sample.surahId}:${sample.ayahNumber} — ${sample.matched}/${sample.tokenCount} token berglos (${pct}%)${sample.missing.length > 0 ? `, tanpa glos: ${sample.missing.join(", ")}` : ""}`,
    );
  }

  const cov = validated.coverage;
  console.log(
    `▶ langkah 3 — count-check scope: ${cov.tokensWithGloss.toLocaleString("id-ID")}/${cov.tokens.toLocaleString("id-ID")} token berglos; ${cov.ayahsFullyCovered}/${cov.ayahs} ayat penuh`,
  );

  if (validated.issues.length > 0) {
    console.error(`✖ ${validated.issues.length} masalah word-gloss (gagal, tidak ada emit):`);
    for (const issue of validated.issues) console.error(`  - ${issue.problem}`);
    process.exit(1);
  }
  if (validated.warnings.length > 0) {
    console.warn(`⚠ ${validated.warnings.length} catatan (tidak menghalangi emit):`);
    for (const w of validated.warnings.slice(0, 10)) console.warn(`  - [${w.scope}] ${w.detail}`);
    if (validated.warnings.length > 10) console.warn(`  ... dan ${validated.warnings.length - 10} lagi`);
  }

  await emitWordGloss(validated, GLOSS_SURAH_IDS, { sourceFile: best.file });
  const emittedAyahs = Object.values(validated.glosses).reduce((n, ayahs) => n + Object.keys(ayahs).length, 0);
  const emittedTokens = Object.values(validated.glosses).reduce(
    (acc, ayahs) => acc + Object.values(ayahs).reduce((n, entries) => n + entries.length, 0),
    0,
  );
  console.log(`✔ emit ${emittedAyahs} ayat, ${emittedTokens.toLocaleString("id-ID")} glos kata → src/data/content/${"word-gloss-juz30.json"}`);
  console.log("  ☐ Review manusia (RULES § 7.7): buka word-gloss-juz30.json, cek min. 5 ayat — glos harus masuk akal.");
}

main().catch((error: unknown) => {
  console.error(`✖ Pipeline word-gloss gagal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
