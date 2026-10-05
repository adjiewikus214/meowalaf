/**
 * Generator ikon Meowalaf — `npm run brand:icons` (lihat BRAND.md § 7).
 *
 * Semua ikon digambar DI SINI, dari nol, dengan bentuk vektor + supersampling,
 * lalu ditulis sebagai PNG lewat `png.mjs` (zlib saja, tanpa dependency).
 *
 * Kenapa digambar sendiri, bukan memakai berkas desain dari luar:
 *   1. **Lisensi bersih.** Ikon kucing islami yang beredar di internet hampir
 *      semuanya tanpa lisensi yang jelas; contoh yang dipakai sebagai acuan gaya
 *      pun berwatermark komersial. Bentuk di file ini adalah karya repo ini
 *      (RULES § 7.8) — acuan hanya menentukan *gaya*, tidak pernah disalin.
 *   2. **Bisa direview.** Ikut masuk code review seperti kode lain, dan
 *      perubahan bentuk terlihat sebagai diff, bukan file biner misterius.
 *   3. **Reproducible.** Satu perintah menghasilkan ulang keenam berkas; tidak
 *      ada langkah manual di editor gambar yang tidak bisa diulang siapa pun.
 *
 * Motif (sama dengan maskot in-app `src/ui/components/CatMascot.tsx`): **Abu** —
 * kucing British Shorthair abu-abu yang duduk memeluk mushaf kecil, memakai
 * peci biru berpetak emas, dengan bulan sabit + bintang di sudut. Ruang
 * koordinat di sini memakai peta 0–200 yang sama dengan SVG komponen itu, jadi
 * kedua gambar tetap sinkron saat salah satu diubah.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { encodePng } from "./png.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ASSETS = path.join(ROOT, "assets");

const hex = (value) => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
];

const INK = hex("#0B0F0E");
const INK_2 = hex("#12201B");
const EMERALD = hex("#10B981");
const GOLD = hex("#E0B44A");
const ASH = hex("#98A4AD");
const ASH_DEEP = hex("#78858F");
const LIGHT = hex("#FBF8F3");
const BLUSH = hex("#E79F9A");
const CAP = hex("#6FA9C0");
const CAT_INK = hex("#232B2F");
const WHITE = [255, 255, 255];

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Bidang gambar: float RGBA (0–255, alpha 0–1), straight alpha. */
class Canvas {
  constructor(size) {
    this.size = size;
    this.data = new Float32Array(size * size * 4);
  }

  /** Sumber-di-atas (src-over) satu pixel. */
  blend(x, y, rgb, alpha) {
    if (alpha <= 0) return;
    const i = (y * this.size + x) * 4;
    const d = this.data;
    const da = d[i + 3];
    const outA = alpha + da * (1 - alpha);
    if (outA <= 0) return;
    d[i] = (rgb[0] * alpha + d[i] * da * (1 - alpha)) / outA;
    d[i + 1] = (rgb[1] * alpha + d[i + 1] * da * (1 - alpha)) / outA;
    d[i + 2] = (rgb[2] * alpha + d[i + 2] * da * (1 - alpha)) / outA;
    d[i + 3] = outA;
  }

  /**
   * Isi satu bentuk. `color` boleh fungsi `(x, y) => [r, g, b, a?]` — dipakai
   * supaya "gigitan" bulan sabit memakai warna latar yang persis (termasuk
   * gradien + glow), bukan warna solid yang salah di atas gradien.
   */
  fill(shape, color) {
    const SS = 4; // 4×4 subsample per pixel ≈ anti-aliasing 16 tingkat
    const [bx0, by0, bx1, by1] = shape.bounds;
    const x0 = Math.max(0, Math.floor(bx0));
    const y0 = Math.max(0, Math.floor(by0));
    const x1 = Math.min(this.size - 1, Math.ceil(bx1));
    const y1 = Math.min(this.size - 1, Math.ceil(by1));
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        let hits = 0;
        for (let sy = 0; sy < SS; sy += 1) {
          for (let sx = 0; sx < SS; sx += 1) {
            if (shape.inside(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS)) hits += 1;
          }
        }
        if (hits === 0) continue;
        const coverage = hits / (SS * SS);
        const rgba = typeof color === "function" ? color(x + 0.5, y + 0.5) : color;
        this.blend(x, y, rgba, (rgba[3] ?? 1) * coverage);
      }
    }
  }

  /** Turunkan resolusi dengan box filter (alpha di-rata secara premultiplied). */
  resize(target) {
    const out = new Canvas(target);
    const ratio = this.size / target;
    for (let y = 0; y < target; y += 1) {
      const sy0 = Math.floor(y * ratio);
      const sy1 = Math.max(sy0 + 1, Math.floor((y + 1) * ratio));
      for (let x = 0; x < target; x += 1) {
        const sx0 = Math.floor(x * ratio);
        const sx1 = Math.max(sx0 + 1, Math.floor((x + 1) * ratio));
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        let count = 0;
        for (let sy = sy0; sy < sy1; sy += 1) {
          for (let sx = sx0; sx < sx1; sx += 1) {
            const i = (Math.min(sy, this.size - 1) * this.size + Math.min(sx, this.size - 1)) * 4;
            const pa = this.data[i + 3];
            r += this.data[i] * pa;
            g += this.data[i + 1] * pa;
            b += this.data[i + 2] * pa;
            a += pa;
            count += 1;
          }
        }
        const o = (y * target + x) * 4;
        if (a > 0) {
          out.data[o] = r / a;
          out.data[o + 1] = g / a;
          out.data[o + 2] = b / a;
        }
        out.data[o + 3] = a / count;
      }
    }
    return out;
  }

  toRgba() {
    const out = new Uint8Array(this.data.length);
    for (let i = 0; i < this.data.length; i += 1) {
      out[i] = i % 4 === 3
        ? Math.round(this.data[i] * 255)
        : Math.round(Math.max(0, Math.min(255, this.data[i])));
    }
    return out;
  }

  /** Bungkus jadi PNG siap tulis (opsional diturunkan ke `target` px). */
  png(target) {
    const canvas = target === undefined || target === this.size ? this : this.resize(target);
    return encodePng(canvas.size, canvas.size, canvas.toRgba());
  }
}

// ---------- bentuk dasar ----------

const full = (size) => ({ bounds: [0, 0, size, size], inside: () => true });

const ellipse = (cx, cy, rx, ry) => ({
  bounds: [cx - rx, cy - ry, cx + rx, cy + ry],
  inside: (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1,
});

const circle = (cx, cy, r) => ellipse(cx, cy, r, r);

const rect = (x0, y0, x1, y1) => ({
  bounds: [x0, y0, x1, y1],
  inside: (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1,
});

/** Titik dalam poligon (even-odd) — supersampling yang mengurus tepi. */
const polygon = (points) => {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    bounds: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    inside: (x, y) => {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    },
  };
};

function segmentDistance(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSq));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

/** Batang dengan ujung bulat — kumis, mulut, ekor, tepi buku. */
const capsule = (x1, y1, x2, y2, width) => {
  const pad = width / 2 + 1;
  return {
    bounds: [
      Math.min(x1, x2) - pad,
      Math.min(y1, y2) - pad,
      Math.max(x1, x2) + pad,
      Math.max(y1, y2) + pad,
    ],
    inside: (x, y) => segmentDistance(x, y, x1, y1, x2, y2) <= width / 2,
  };
};

/** Kotak bersudut bulat (pita peci). */
const roundRect = (cx, cy, w, h, r) => {
  const halfW = w / 2 - r;
  const halfH = h / 2 - r;
  return {
    bounds: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2],
    inside: (x, y) => {
      const dx = Math.max(Math.abs(x - cx) - halfW, 0);
      const dy = Math.max(Math.abs(y - cy) - halfH, 0);
      return dx * dx + dy * dy <= r * r;
    },
  };
};

/** Cincin (donat) — dasar mata senyum. */
const ring = (cx, cy, rOuter, rInner) => ({
  bounds: [cx - rOuter, cy - rOuter, cx + rOuter, cy + rOuter],
  inside: (x, y) => {
    const d = Math.hypot(x - cx, y - cy);
    return d <= rOuter && d >= rInner;
  },
});

/** A − B (dipakai sabit & belahan cincin). */
const subtract = (a, b) => ({ bounds: a.bounds, inside: (x, y) => a.inside(x, y) && !b.inside(x, y) });

const crescent = (cx, cy, r, bx, by, br) => subtract(circle(cx, cy, r), circle(bx, by, br));

/**
 * Belahan ATAS cincin = mata senyum tertutup "∩" (persis `Q` di CatMascot.tsx).
 * Belahan bawah menghasilkan "∪" — wajahnya langsung terlihat cemberut, dan itu
 * pernah terjadi: ikon terbaca seperti kucing bermuka masam.
 */
const happyEyeArc = (cx, cy, rOuter, rInner) =>
  subtract(ring(cx, cy, rOuter, rInner), rect(cx - rOuter - 1, cy, cx + rOuter + 1, cy + rOuter + 1));

/** Kubah peci: setengah ellipse (bagian atas saja). */
const dome = (cx, baseY, rx, ry) =>
  subtract(ellipse(cx, baseY, rx, ry), rect(cx - rx - 1, baseY, cx + rx + 1, baseY + ry + 1));

/** Bintang kecil 4 sudut (belah ketupat ganda). */
const sparkle = (cx, cy, outer, inner) => {
  const points = [];
  for (let i = 0; i < 8; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 4) * i - Math.PI / 2;
    points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  return polygon(points);
};

// ---------- adegan (peta koordinat 0–200, sama dengan CatMascot.tsx) ----------

/** Transformasi peta 0–200 → kanvas: fokus di tengah, skala sesuai kebutuhan. */
function projector(size, focus, scale) {
  return (x, y) => [size / 2 + (x - focus[0]) * scale, size / 2 + (y - focus[1]) * scale];
}

function drawAbu(canvas, at, { silhouette = false } = {}) {
  const P = (x, y) => at(x, y);
  const S = (v) => Math.abs(at(1, 0)[0] - at(0, 0)[0]) * v;
  const paint = (rgba) => (silhouette ? WHITE : rgba);

  // Ekor: tiga ruas yang menyusut + ujung membulat (kurva SVG yang sama).
  const tail = [
    [132, 158, 152, 160],
    [152, 160, 170, 146],
    [170, 146, 172, 124],
    [172, 124, 166, 113],
  ];
  tail.forEach(([x1, y1, x2, y2], index) => {
    const a = P(x1, y1);
    const b = P(x2, y2);
    canvas.fill(capsule(a[0], a[1], b[0], b[1], S(13 - index * 1.4)), paint(ASH_DEEP));
  });

  // Badan + dada + kaki belakang. Dada sengaja lebih kecil dari badan: kalau
  // selebar badan, ikonnya terbaca seperti "celemek putih", bukan kucing.
  const body = P(100, 116);
  canvas.fill(ellipse(body[0], body[1], S(54), S(58)), paint(ASH));
  const belly = P(100, 136);
  canvas.fill(ellipse(belly[0], belly[1], S(27), S(32)), paint([...LIGHT, 0.95]));
  for (const paw of [72, 128]) {
    const c = P(paw, 168);
    canvas.fill(ellipse(c[0], c[1], S(14), S(9)), paint(ASH));
  }

  // Kitab terbuka + tepi emas.
  canvas.fill(polygon([P(100, 141), P(62, 139), P(62, 158), P(100, 160)]), paint(LIGHT));
  canvas.fill(polygon([P(100, 141), P(138, 139), P(138, 158), P(100, 160)]), paint(LIGHT));
  const spineTop = P(100, 141);
  const spineBottom = P(100, 160);
  canvas.fill(capsule(spineTop[0], spineTop[1], spineBottom[0], spineBottom[1], S(2)), paint(ASH_DEEP));
  const edgeA = P(62, 158);
  const edgeB = P(100, 160);
  const edgeC = P(138, 158);
  canvas.fill(capsule(edgeA[0], edgeA[1], edgeB[0], edgeB[1], S(3)), paint(GOLD));
  canvas.fill(capsule(edgeB[0], edgeB[1], edgeC[0], edgeC[1], S(3)), paint(GOLD));

  // Kaki depan memeluk kitab.
  for (const paw of [80, 120]) {
    const c = P(paw, 150);
    canvas.fill(ellipse(c[0], c[1], S(13), S(10)), paint(LIGHT));
  }

  // Telinga (di belakang kepala) + telinga dalam.
  const earLeft = polygon([P(58, 66), P(66, 26), P(92, 56)]);
  const earRight = polygon([P(142, 66), P(134, 26), P(108, 56)]);
  canvas.fill(earLeft, paint(ASH));
  canvas.fill(earRight, paint(ASH));
  canvas.fill(polygon([P(66, 60), P(71, 33), P(87, 56)]), paint(BLUSH));
  canvas.fill(polygon([P(134, 60), P(129, 33), P(113, 56)]), paint(BLUSH));

  // Kepala + moncong.
  const head = P(100, 80);
  canvas.fill(ellipse(head[0], head[1], S(46), S(42)), paint(ASH));
  const muzzle = P(100, 96);
  canvas.fill(ellipse(muzzle[0], muzzle[1], S(24), S(16)), paint([...LIGHT, 0.9]));

  // Peci: kubah + pita + tiga belah ketupat emas.
  const capBase = P(100, 44);
  canvas.fill(dome(capBase[0], capBase[1], S(28), S(25)), paint(CAP));
  canvas.fill(roundRect(capBase[0], capBase[1], S(60), S(10), S(4)), paint(LIGHT));
  for (const dx of [-15, 0, 15]) {
    const c = P(100 + dx, 44);
    canvas.fill(
      polygon([[c[0], c[1] - S(2.5)], [c[0] + S(2.5), c[1]], [c[0], c[1] + S(2.5)], [c[0] - S(2.5), c[1]]]),
      paint(GOLD),
    );
  }

  if (silhouette) return;

  // Kumis: dua per sisi (bukan tiga), tipis, dan mulai di pipi — tiga batang
  // tebal di wajah sekecil ini menyatu jadi seperti kumis besar.
  const whiskers = [
    [62, 88, 32, 82],
    [62, 96, 34, 102],
    [138, 88, 168, 82],
    [138, 96, 166, 102],
  ];
  for (const [x1, y1, x2, y2] of whiskers) {
    const a = P(x1, y1);
    const b = P(x2, y2);
    canvas.fill(capsule(a[0], a[1], b[0], b[1], S(1.6)), [...CAT_INK, 0.26]);
  }

  // Pipi merona.
  for (const cx of [68, 132]) {
    const c = P(cx, 92);
    canvas.fill(ellipse(c[0], c[1], S(9), S(6)), [...BLUSH, 0.5]);
  }

  // Mata senyum tertutup (ciri paling terbaca di ukuran kecil).
  for (const cx of [86, 114]) {
    const c = P(cx, 78);
    canvas.fill(happyEyeArc(c[0], c[1], S(15), S(10.5)), CAT_INK);
  }

  // Hidung + mulut "ω" yang turun di bawah hidung.
  canvas.fill(polygon([P(95, 82), P(105, 82), P(100, 88)]), BLUSH);
  const mouth = P(100, 89);
  const mouthLeft = P(93, 97);
  const mouthRight = P(107, 97);
  canvas.fill(capsule(mouth[0], mouth[1], mouthLeft[0], mouthLeft[1], S(2.2)), CAT_INK);
  canvas.fill(capsule(mouth[0], mouth[1], mouthRight[0], mouthRight[1], S(2.2)), CAT_INK);
}

/** Bulan sabit + bintang (aksen islami). */
function drawMoon(canvas, at, { silhouette = false } = {}) {
  const color = silhouette ? WHITE : GOLD;
  const [mx, my] = at(171, 19);
  const [bx, by] = at(184, 8);
  const scale = Math.abs(at(1, 0)[0] - at(0, 0)[0]);
  canvas.fill(crescent(mx, my, scale * 15, bx, by, scale * 12), color);
  const [sx, sy] = at(170, 55);
  canvas.fill(sparkle(sx, sy, scale * 8, scale * 2.6), color);
}

/** Latar ikon: gradien gelap + glow emerald di belakang maskot. */
function backdropFactory(size, focus, scale) {
  const [fx, fy] = projector(size, focus, scale)(100, 120);
  return (x, y) => {
    const t = y / size;
    const base = mix(INK, INK_2, t);
    const distance = Math.hypot(x - fx, y - fy) / (size * 0.52);
    const glow = Math.max(0, 1 - distance) ** 2 * 0.3;
    return [...mix(base, EMERALD, glow), 1];
  };
}

// ---------- berkas yang dihasilkan ----------

const MASTER = 1024;
/** Titik tengah karakter di peta 0–200 (kepala + badan + kitab). */
const CENTER = [108, 96];

function renderAppIcon(size) {
  const canvas = new Canvas(MASTER);
  const backdrop = backdropFactory(MASTER, CENTER, 4.6);
  canvas.fill(full(MASTER), (x, y) => [...backdrop(x, y)]);
  const at = projector(MASTER, CENTER, 4.6);
  drawMoon(canvas, at);
  drawAbu(canvas, at);
  return canvas.png(size);
}

function renderSplash(size) {
  const canvas = new Canvas(MASTER);
  const at = projector(MASTER, CENTER, 3.6);
  drawMoon(canvas, at);
  drawAbu(canvas, at);
  return canvas.png(size);
}

function renderAdaptiveForeground(size) {
  const canvas = new Canvas(MASTER);
  // 1,9 = konten masuk di dalam safe zone 66% Android (adaptive icon di-crop).
  const at = projector(MASTER, CENTER, 1.9);
  drawMoon(canvas, at);
  drawAbu(canvas, at);
  return canvas.png(size);
}

function renderAdaptiveBackground(size) {
  const canvas = new Canvas(MASTER);
  const backdrop = backdropFactory(MASTER, CENTER, 0.8);
  canvas.fill(full(MASTER), (x, y) => [...backdrop(x, y)]);
  return canvas.png(size);
}

function renderMonochrome(size) {
  const canvas = new Canvas(MASTER);
  const at = projector(MASTER, CENTER, 1.9);
  drawMoon(canvas, at, { silhouette: true });
  drawAbu(canvas, at, { silhouette: true });
  return canvas.png(size);
}

export const ICON_FILES = [
  { file: "icon.png", size: 1024, render: () => renderAppIcon(1024) },
  { file: "favicon.png", size: 48, render: () => renderAppIcon(48) },
  { file: "splash-icon.png", size: 1024, render: () => renderSplash(1024) },
  { file: "android-icon-foreground.png", size: 512, render: () => renderAdaptiveForeground(512) },
  { file: "android-icon-background.png", size: 512, render: () => renderAdaptiveBackground(512) },
  { file: "android-icon-monochrome.png", size: 432, render: () => renderMonochrome(432) },
];

export function renderAssets() {
  return ICON_FILES.map(({ file, size, render }) => ({ file, size, png: render() }));
}

function main() {
  const started = Date.now();
  for (const { file, size, png } of renderAssets()) {
    fs.writeFileSync(path.join(ASSETS, file), png);
    console.log(`${file.padEnd(32)} ${size}×${size}  ${(png.length / 1024).toFixed(1)} KB`);
  }
  console.log(`\n${ICON_FILES.length} berkas ditulis ke assets/ dalam ${Date.now() - started} ms.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
