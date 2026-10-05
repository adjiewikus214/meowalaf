/**
 * Penjaga: harness performa tidak boleh memakai hook yang sudah tidak ada.
 *
 * `scripts/perf-budget.mjs` menyuntik DRIVER ke index.html lalu mengklik lewat
 * `data-testid`. Kalau ada `testID` yang di-rename di komponen, harness TIDAK
 * gagal — dia cuma tidak menemukan tombol, menunggu sampai `waitFor` habis, dan
 * melaporkan "lesson 15 detik" seolah-olah app-nya lambat. Persis begitu yang
 * terjadi sebelum hook ini ada: DRIVER pernah mencari teks "MATERI"/"SOAL" dan
 * "Lanjut Ngaji", jadi begitu copy masuk kamus atau locale berubah, gate-nya
 * mengukur terjemahan.
 *
 * Test ini menutup dua arah sekaligus:
 *   1. Setiap id yang dipakai DRIVER benar-benar ada di sumber app — termasuk
 *      yang dibangun dari template (`testID={\`lesson-phase-${view.phase}\`}`),
 *      karena `lesson-phase-materi` yang dicari driver muncul sebagai prefix
 *      template, bukan string persis.
 *   2. DRIVER tidak diam-diam kembali ke mencari teks tombol (mis. `byText`).
 *
 * Sengaja membaca file sebagai teks: `--link=fast4g` butuh Chrome + 40 s
 * throttle, dan build `dist/` bisa saja belum ada saat test jalan.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const HARNESS = path.join(ROOT, "scripts", "perf-budget.mjs");
const SOURCE_DIRS = ["app", "src"];

const driverSource = fs.readFileSync(HARNESS, "utf8");

function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      walk(full, acc);
    } else if (/\.tsx$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

const sources = SOURCE_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)));
const sourceText = sources.map((file) => fs.readFileSync(file, "utf8")).join("\n");

/**
 * Setiap id yang dirujuk driver, dari tiga sumber:
 *   - byTestId('x') / enabled('x')  → cek satu id
 *   - allTestIds('x')                → cek prefix
 *   - FAKE_ZERO_TOKENS = ['x', ...]  → daftar id untuk deteksi angka-0 palsu
 */
function referencedIds(): string[] {
  const ids = new Set<string>();
  const patterns = [/byTestId\('([^']+)'\)/g, /enabled\('([^']+)'\)/g, /allTestIds\('([^']+)'\)/g];
  for (const re of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(driverSource)) !== null) ids.add(match[1] ?? "");
  }
  const tokens = /FAKE_ZERO_TOKENS\s*=\s*\[([^\]]*)\]/.exec(driverSource);
  if (tokens?.[1]) {
    for (const m of tokens[1].matchAll(/'([^']+)'/g)) ids.add(m[1] ?? "");
  }
  return [...ids].filter(Boolean);
}

/**
 * Kumpulan testID yang benar-benar bisa dirender oleh app:
 *   - yang statis  : `testID="home-continue"`
 *   - dari template: `testID={\`lesson-phase-${view.phase}\`}` → prefix
 *     "lesson-phase-" (bagian sebelum `${`).
 *
 * Id dari driver dianggap ada kalau cocok persis dengan yang statis, atau
 * diawali salah satu prefix template. Ini lebih ketat daripada sekadar
 * `includes()`: kalau driver cari `lesson-audoi-1` (typo), tidak akan lolos.
 */
function renderedTestIds(): { exact: Set<string>; prefixes: string[] } {
  const exact = new Set<string>();
  const prefixes: string[] = [];
  for (const m of sourceText.matchAll(/testID="([^"]+)"/g)) exact.add(m[1] ?? "");
  for (const m of sourceText.matchAll(/testID=\{`([^`]+)`\}/g)) {
    const raw = m[1] ?? "";
    const at = raw.indexOf("${");
    if (at >= 0) prefixes.push(raw.slice(0, at));
    else exact.add(raw);
  }
  return { exact, prefixes };
}

describe("harness performa (RULES § 9)", () => {
  const { exact, prefixes } = renderedTestIds();

  it("semua testID yang dicari harness benar-benar bisa dirender app", () => {
    const missing = referencedIds().filter((id) => !exact.has(id) && !prefixes.some((p) => id.startsWith(p)));
    expect(
      missing,
      "testID ini dipakai scripts/perf-budget.mjs tapi tidak ada di app: " +
        missing.join(", ") +
        ". Gate akan diam-diam menunggu sampai timeout, bukan gagal cepat.",
    ).toEqual([]);
  });

  it("harness tidak lagi mencari tombol lewat teksnya", () => {
    // `byText`/`leafText` menghapus affordance yang membuat testID ada.
    // Kalau salah satu muncul lagi, DRIVER kembali mengukur copy, bukan layar.
    expect(driverSource).not.toMatch(/\bbyText\s*\(/);
    expect(driverSource).not.toMatch(/\bleafText\s*\(/);
  });

  it("DRIVER benar-benar punya langkah yang diuji (scanner tidak mati diam-diam)", () => {
    const ids = referencedIds();
    expect(ids.length, "tidak ada testID terbaca dari DRIVER - scanner-nya rusak?").toBeGreaterThan(8);
    expect(ids).toContain("home-continue");
    expect(ids).toContain("lesson-phase-materi");
    // Driver harus punya minimal satu prefix dinamis supaya cek template di atas
    // benar-benar teruji, bukan selalu lolos karena kebetulan.
    expect(prefixes.some((p) => p === "lesson-phase-")).toBe(true);
  });
});