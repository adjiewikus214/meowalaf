/**
 * Subset font Ayatin — hanya glyph yang benar-benar dirender app.
 *
 *   npm run fonts:subset                      # korpus repo (paling kecil)
 *   npm run fonts:subset -- --with-arabic-blocks   # tahan semua teks Arab
 *
 * Sumber (font asli, tidak pernah dibundel) : src/ui/assets/fonts/_source/
 * Hasil (yang dibundel)                       : src/ui/assets/fonts/<nama>.ttf
 *
 * Nama file hasil PENTING tetap sama dengan aslinya: app/_layout.tsx memetakan
 * file itu ke FONT_MAP, jadi kunci font tidak berubah dan tidak ada risiko FOUT.
 *
 * Font asli disimpan supaya pipeline bisa dijalankan ulang offline. Kalau
 * `_source/` hilang, subset tidak bisa dibangun ulang — dan tidak ada yang
 * mengembalikannya, karena yang dipakai aplikasi tetap file hasil subset.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import subsetFont from "subset-font";

import { readCmapCodepoints } from "./cmap.mjs";
import { FONT_PLAN, PROJECT_ROOT, collectGlyphs } from "./glyphs.mjs";

const FONT_DIR = path.join(PROJECT_ROOT, "src", "ui", "assets", "fonts");
const SOURCE_DIR = path.join(FONT_DIR, "_source");

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const gzipKb = (bytes) => kb(zlib.gzipSync(bytes, { level: 9 }).length);
const hex = (cp) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;

async function subsetOne(plan, codepoints, contentCodepoints) {
  const sourcePath = path.join(SOURCE_DIR, plan.file);
  const outPath = path.join(FONT_DIR, plan.file);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`font asli hilang: ${path.relative(PROJECT_ROOT, sourcePath)}`);
  }

  const source = fs.readFileSync(sourcePath);
  const sourceCmap = new Set(readCmapCodepoints(source));

  const subset = Buffer.from(
    await subsetFont(source, String.fromCodePoint(...codepoints), {
      targetFormat: "truetype", // expo-font memakai file .ttf sebagai asset, bukan woff2
      // Name ID 1-6 (family, subfamily, unique, full name, version, PS name):
      // harfbuzz membuangnya sebagai default, padahal Play Store dan panel debug
      // font butuh nama terbaca.
      preserveNameIds: [1, 2, 3, 4, 5, 6],
      // Instruksi hinting TrueType dibuang: teks UI terkecil 9 px dan target
      // utamanya web, jadi tidak sebanding dengan ukuran yang dipangkas.
      noHinting: true,
    }),
  );

  const covered = new Set(readCmapCodepoints(subset));
  // Yang benar-benar regressions: glyph yang ADA di font asli, diminta, tapi hilang
  // setelah subset. Glyph yang memang tidak ada di font asli (U+1E24 di Plus Jakarta,
  // U+08D6 di Amiri) bukan urusan subset — sudah jatuh ke font sistem sejak dulu.
  const lost = codepoints.filter((cp) => sourceCmap.has(cp) && !covered.has(cp));
  // Hanya glyph dari teks app yang dilaporkan: kalau user melihat kotak tofu,
  // itu karena karakter nyata di UI, bukan karena range padding yang tidak punya
  // glyph di font asal.
  const systemFallback = contentCodepoints.filter((cp) => !covered.has(cp));

  return { subset, source, sourceCmap, covered, lost, systemFallback, outPath };
}

async function main() {
  const fullArabicBlocks = process.argv.includes("--with-arabic-blocks");
  const { ui, arabic, translit, fromContent, sourceFileCount } = collectGlyphs({ fullArabicBlocks });
  const sets = {
    ui: { all: ui, fromContent: fromContent.ui },
    arabic: { all: arabic, fromContent: fromContent.arabic },
    // Fallback transliterasi: set tetap, konten yang relevan = karakter
    // transliterasi yang benar-benar muncul di teks terjemahan ayat.
    translit: { all: translit, fromContent: fromContent.translit },
  };
  console.log(
    `Inventaris: ${sourceFileCount} file sumber · ${ui.length} glyph UI · ${arabic.length} glyph Arab` +
      `${fullArabicBlocks ? " (blok penuh)" : " (korpus repo)"}`,
  );
  console.log();

  const rows = [];
  let failed = false;

  for (const plan of FONT_PLAN) {
    const wanted = sets[plan.set].all;
    const result = await subsetOne(plan, wanted, sets[plan.set].fromContent);

    if (result.lost.length > 0) {
      failed = true;
      console.error(
        `  GAGAL ${plan.file}: ${result.lost.length} glyph hilang vs font asli ` +
          `(${result.lost.slice(0, 12).map(hex).join(", ")}${result.lost.length > 12 ? "…" : ""})`,
      );
    }

    // Jangan tulis hasil kalau ada glyph hilang — app lebih baik pakai subset
    // lama yang utuh daripada font yang bolong.
    if (result.lost.length === 0) fs.writeFileSync(result.outPath, result.subset);

    rows.push({
      font: plan.file,
      role: plan.role,
      kept: `${wanted.length} diminta / ${result.covered.size} di font`,
      covered: result.covered,
      raw: `${kb(result.source.length)} -> ${kb(result.subset.length)}`,
      gzip: `${gzipKb(result.source)} -> ${gzipKb(result.subset)}`,
      fallback: result.systemFallback,
      lost: result.lost.length,
    });
  }

  const width = Math.max(...rows.map((r) => r.font.length));
  for (const row of rows) {
    console.log(
      `${row.font.padEnd(width)}  ${row.kept.padEnd(26)}  raw ${row.raw.padEnd(22)}  gzip ${row.gzip}`,
    );
  }
  console.log();

  // Karakter teks app yang tidak dilayani satu pun font: dihitung lintas semua
  // font (bukan per font), karena yang terlihat di layar adalah gabungan ketiganya.
  const coveredByAny = new Set(rows.flatMap((row) => [...row.covered]));
  const orphans = [...fromContent.ui, ...fromContent.arabic].filter((cp) => !coveredByAny.has(cp));
  if (orphans.length > 0) {
    console.log(
      `Teks app memakai ${orphans.length} karakter yang tidak dilayani font mana pun ` +
        `-> dirender font sistem, sama seperti sebelum subset:`,
    );
    console.log(`  ${orphans.map(hex).join(" ")}`);
  }
  const arabicOrphans = orphans.filter((cp) => cp >= 0x600 && cp <= 0x8ff);
  if (arabicOrphans.length === 0) {
    console.log("Teks Arab 100% dilayani Amiri.");
  } else {
    console.log(
      `  Termasuk ${arabicOrphans.length} kode Arab (${arabicOrphans.map(hex).join(" ")}): Amiri tidak punya glyph itu,` +
        `jadi satu harakat diambil dari font Arab sistem. Kalau ini bertambah, ganti font mushaf.`,
    );
  }

  if (failed) {
    console.error("\nSubset bermasalah — file hasil tidak ditulis. Perbaiki glyphs.mjs.");
    process.exitCode = 1;
    return;
  }
  console.log("\nTidak ada glyph yang hilang dibanding font asli. Tulis: src/ui/assets/fonts/");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});