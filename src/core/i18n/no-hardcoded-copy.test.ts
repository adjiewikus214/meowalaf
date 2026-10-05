/**
 * Penjaga: tidak boleh ada copy user-facing yang ditulis langsung di JSX.
 *
 * Suite `i18n.test.ts` menjaga kamusnya (paritas kunci, tone, RULES § 7.5).
 * Test ini menjaga sisi yang berlawanan: kalau ada kalimat Indonesia yang
 * diketik langsung di komponen, suite itu tetap hijau — kuncinya memang ada,
 * cuma tidak terpakai. Contoh nyata yang pernah lolos review:
 * "tombol kebuka setelah audio jalan" di MateriPanel. Di profil English teks itu
 * tetap Bahasa Indonesia, dan tidak ada satu pun test yang gagal.
 *
 * Cara kerja: baca sumber .tsx sebagai TEKS (bukan render), lalu ambil isi antar
 * tag JSX. Yang dicek hanya literal di badan JSX — bukan string di atribut,
 * bukan nama import, bukan komentar. Alasannya: attr `className` dan `import`
 * bukan copy, sedangkan isi `<Text>...</Text>` selalu copy yang dilihat user.
 *
 * Sadar tradeoff: ini analisis leksikal, bukan compiler. False positive
 * mungkin terjadi, tapi lebih baik satu review tambahan daripada bahasa yang
 * diam-diam tertinggal. Test ini jaring pengaman, bukan jaminan.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const SCAN_DIRS = ["app", "src"];

/**
 * Kata Indonesia yang hanya muncul di dalam kalimat user-facing. Dipilih yang
 * jelas tidak mungkin menjadi nilai enum/kode: "id" (locale), "en", nama file,
 * dan nama komponen semuanya bukan bahasa Indonesia.
 */
const INDONESIAN_MARKERS = [
  "yang",
  "dan",
  "atau",
  "dulu",
  "belum",
  "sudah",
  "buat",
  "aja",
  "yuk",
  "nggak",
  "gak",
  "kek",
  "tombol",
  "layar",
  "ketemu",
  "setelah",
  "sebelum",
  "coba",
  "ayo",
  "klik",
  "kita",
  "silakan",
  "ayo",
  "kamu",
  "biar",
  "habis",
  "kepada",
  "untuk",
  "dengan",
  "sedang",
  "tunggu",
  "masih",
  "saja",
  "lagi",
  "sama",
  "banyak",
  "sedikit",
  "hari",
  "ayat",
  "surah",
  "audio",
  "progres",
  "lesson",
  "belajar",
  "ngaji",
];

/** Buang blok yang jelas bukan copy: komentar, template literal, dan ekspresi. */
function stripNonCopy(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/[^\n]*$/gm, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/\{[^{}]*\}/g, " ");
}

/**
 * Literal yang masih bisa jadi copy setelah di-strip. Sisa kurung kurawal
 * sering muncul karena ekspresi `{t("kunci", { ... })}` punya brace bersarang
 * yang tidak bisa di-strip satu lapis — sisa seperti itu bukan copy user.
 */
function looksLikeCopy(literal: string): boolean {
  if (/[(){}[\];=]/.test(literal)) return false;
  return /[a-zA-Z]/.test(literal);
}

/** Ambil literal di antara `>` dan `<` — itu isi JSX yang dirender sebagai teks. */
function jsxLiterals(source: string): string[] {
  const cleaned = stripNonCopy(source);
  const out: string[] = [];
  const re = />([^<>]+)</g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cleaned)) !== null) {
    const body = (match[1] ?? "").replace(/\s+/g, " ").trim();
    if (body.length >= 4 && looksLikeCopy(body)) out.push(body);
  }
  return out;
}

function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      walk(full, acc);
    } else if (/\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe("copy tidak boleh ditulis langsung di JSX", () => {
  it("tidak ada kalimat Indonesia yang lolos dari kamus", () => {
    const offenders: string[] = [];
    const files = SCAN_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)));
    expect(files.length, "tidak ada .tsx yang discan - path salah?").toBeGreaterThan(10);

    for (const file of files) {
      const rel = path.relative(ROOT, file).replace(/\\/g, "/");
      const source = fs.readFileSync(file, "utf8");
      for (const literal of jsxLiterals(source)) {
        const words = literal.toLowerCase().split(/[^a-z']+/);
        const hits = words.filter((w) => INDONESIAN_MARKERS.includes(w));
        // Satu kata penanda sudah cukup: "tombolnya" atau "kamu" jelas copy.
        if (hits.length >= 1) offenders.push(`${rel}: "${literal}"`);
      }
    }
    expect(offenders, "pindahkan ke src/core/i18n/id.ts + en.ts, lalu pakai t()").toEqual([]);
  });

  it("scanner benar-benar menangkap copy yang diketik langsung", () => {
    // Kalau scanner ini mati diam-diam, test di atas jadi tidak berarti apa-apa.
    const sample = `<View>\n  <Text>tombol kebuka setelah audio jalan</Text>\n</View>`;
    expect(jsxLiterals(sample)).toContain("tombol kebuka setelah audio jalan");
    const clean = `<View className="gap-2">\n  <Text>{t("lesson.materiTitle")}</Text>\n</View>`;
    expect(jsxLiterals(clean)).toEqual([]);
  });
});