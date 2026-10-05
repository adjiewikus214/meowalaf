/**
 * Regression guard untuk ikon Meowalaf (BRAND.md § 7).
 *
 * Tiga hal yang dijaga:
 *  1. **Berkasnya benar-benar ada dan bisa dibaca.** Ikon app hanya "terlihat"
 *     di device; kalau `assets/*.png` hilang atau PNG-nya rusak, build tetap
 *     jalan dan baru ketahuan saat dibuka di HP.
 *  2. **Gambar yang dihasilkan masih merek Meowalaf.** Bukan sekadar "ada file",
 *     tapi ada bulu abu di kepala, peci biru di atasnya, emas di bulan sabit,
 *     dan halaman terang di kitabnya — pada koordinat yang diharapkan.
 *  3. **Tidak ada drift.** Berkas di `assets/` harus identik dengan hasil render
 *     kode saat ini; mengubah bentuk tanpa menjalankan `npm run brand:icons`
 *     langsung ketahuan.
 *
 * Peta koordinat di sini sama dengan maskot in-app (0–200, lihat CatMascot.tsx),
 * dipetakan oleh `projector` dengan fokus (108, 96) dan skala 4,6.
 *
 * Kalau test gagal karena ikon memang sengaja diubah: jalankan
 * `npm run brand:icons`, lalu sesuaikan koordinat sampel di bawah.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { decodePng, pixelAt } from "./png.mjs";
import { ICON_FILES, renderAssets } from "./render-icons.mjs";

const ASSETS = path.resolve(import.meta.dirname, "..", "..", "assets");

const read = (file: string) => decodePng(fs.readFileSync(path.join(ASSETS, file)));

/** `[r, g, b, a]` di koordinat file (ukuran asli, bukan peta 0–200). */
const sample = (file: string, x: number, y: number) => pixelAt(read(file), x, y);

const close = (actual: number, expected: number, tolerance = 10) =>
  Math.abs(actual - expected) <= tolerance;

const isColor = (rgba: number[], hex: number[], label: string) => {
  const [r, g, b] = hex;
  expect(
    [close(rgba[0]!, r!), close(rgba[1]!, g!), close(rgba[2]!, b!)],
    `${label}: dapat rgb(${rgba.slice(0, 3).join(",")})`,
  ).toEqual([true, true, true]);
};

describe("ikon Meowalaf", () => {
  it("semua berkas ikon ada dengan dimensi yang diharapkan app.json", () => {
    for (const { file, size } of ICON_FILES) {
      const filePath = path.join(ASSETS, file);
      expect(fs.existsSync(filePath), `${file} tidak ada — jalankan npm run brand:icons`).toBe(true);
      const image = decodePng(fs.readFileSync(filePath));
      expect([file, image.width, image.height]).toEqual([file, size, size]);
    }
  });

  it("icon.png utuh: latar gelap penuh, tidak ada piksel transparan", () => {
    const corner = sample("icon.png", 4, 4);
    expect(corner[3]).toBe(255);
    expect(corner[0]).toBeLessThan(40);
    expect(corner[1]).toBeLessThan(50);
    expect(corner[2]).toBeLessThan(50);
    expect(sample("icon.png", 1019, 1019)[3]).toBe(255);
  });

  it("maskotnya masih kucing abu-abu berpeci dengan kitab", () => {
    // Kepala (bulu abu BSH), sedikit di atas pusat kepala supaya tidak kena mata.
    isColor(sample("icon.png", 475, 400), [0x98, 0xa4, 0xad], "bulu abu");
    // Kubah peci, di atas dahi.
    isColor(sample("icon.png", 475, 209), [0x6f, 0xa9, 0xc0], "peci biru");
    // Halaman kitab di depan badan (400 = sisi kiri, jauh dari garis punggung).
    isColor(sample("icon.png", 400, 760), [0xfb, 0xf8, 0xf3], "halaman kitab");
  });

  it("aksen islami tetap emas, bukan warna lain", () => {
    // Sisi kiri bulan sabit (di luar lingkaran gigitan).
    isColor(sample("icon.png", 751, 158), [0xe0, 0xb4, 0x4a], "bulan sabit emas");
  });

  it("ikon transparan benar-benar transparan di tepinya, ada isi di tengah", () => {
    for (const file of ["splash-icon.png", "android-icon-foreground.png", "android-icon-monochrome.png"]) {
      const size = read(file).width;
      expect(sample(file, 3, 3)[3], `${file} tepi kiri atas`).toBe(0);
      expect(sample(file, 20, size - 4)[3], `${file} tepi kiri bawah`).toBe(0);
      expect(sample(file, size - 4, size - 4)[3], `${file} tepi kanan bawah`).toBe(0);
    }
    // Monokrom: siluet putih di tengah (Android memakai alpha-nya sebagai mask).
    // Kepala di peta 0–200 → (100, 80) → skala 1,9 → 432 px.
    const head = sample("android-icon-monochrome.png", 210, 203);
    expect(head[3]).toBeGreaterThan(200);
    expect(head[0]).toBeGreaterThan(240);
  });

  it("berkas di assets/ identik dengan hasil render saat ini (bukan sisa render lama)", () => {
    const rendered = renderAssets();
    for (const { file, png } of rendered) {
      const onDisk = fs.readFileSync(path.join(ASSETS, file));
      expect(onDisk.equals(png), `${file} tidak sinkron — jalankan npm run brand:icons`).toBe(true);
    }
  }, 60_000);
});
