/**
 * Pratinjau **semua pose & animasi maskot** — satu halaman HTML statis.
 *
 *   npm run brand:mascot-preview            # -> dist/_brand/mascot-preview.html
 *                                           #    lihat di http://127.0.0.1:8132/_brand/mascot-preview
 *   npm run brand:mascot-preview -- out.html
 *
 * Kenapa ada: maskot punya 6 mood × 2 pose × 2 varian bulu, dan menguji
 * semuanya lewat app (buka onboarding → buka lesson → jawab salah → ...) itu
 * lambat dan mudah terlewat. Di sini semuanya tampil sekaligus.
 *
 * Yang penting: halaman ini **tidak menggambar ulang apa pun**. Ia memanggil
 * `catScene()` — modul yang sama yang dipakai `CatMascot.tsx` — jadi pratinjau
 * tidak mungkin menyimpang dari yang dilihat user (bandingkan dengan ikon app
 * yang punya salinan peta koordinat sendiri di `render-icons.mjs`).
 * Durasi & amplitudo gerak pun dibaca dari `CAT_MOTION`, bukan ditulis ulang.
 *
 * Catatan kecil: CSS tidak bisa meniru `withTiming` milik Reanimated persis
 * (kurva easing & lompatan `|sin|` didekati dengan keyframe). Yang sama persis
 * adalah geometri, warna, dan angka durasinya.
 *
 * Halaman ini juga punya tombol "matikan gerak" yang meniru
 * `useReducedMotion()` — supaya bisa dipastikan tidak ada yang bergerak saat
 * user memakai reduced-motion (di app, keputusan itu otomatis dari setelan OS).
 */
import fs from "node:fs";
import path from "node:path";

import {
  CAT_MOTION,
  CAT_MOODS,
  CAT_POSES,
  CAT_VARIANTS,
  catScene,
  type CatEntrance,
  type CatLayer,
  type CatMood,
  type CatPose,
  type CatPrimitive,
  type CatVariant,
} from "../../src/ui/cat-art";

/** Ruang koordinat art — sama dengan CatMascot.tsx & cat-art.ts. */
const ART = 200;

const MOOD_LABEL: Record<CatMood, string> = {
  idle: "idle · tenang",
  happy: "happy · mata senyum",
  cheer: "cheer · selesai lesson",
  encourage: "encourage · menemani",
  sleepy: "sleepy",
  wink: "wink",
};

const POSE_LABEL: Record<CatPose, string> = {
  sit: "pose <code>sit</code> — duduk memeluk kitab",
  wave: "pose <code>wave</code> — melambai dengan kaki depan kanan",
};

const VARIANT_LABEL: Record<CatVariant, string> = {
  ash: "Abu — British Shorthair abu-abu (default)",
  cream: "Varian <code>cream</code> — kucing putih",
};

/**
 * Ukuran yang benar-benar dipakai app — supaya keterbacaan di 56 px (kartu soal)
 * ikut terlihat, bukan hanya di 116 px (onboarding).
 */
export const REAL_SIZE_PREVIEWS: readonly {
  size: number;
  mood: CatMood;
  pose: CatPose;
  showMoon: boolean;
  entrance: CatEntrance;
  caption: string;
}[] = [
  { size: 56, mood: "idle", pose: "sit", showMoon: false, entrance: "none", caption: "56 px · kartu soal — kedip mata" },
  { size: 76, mood: "happy", pose: "wave", showMoon: true, entrance: "none", caption: "76 px · kartu sapaan Home" },
  { size: 84, mood: "sleepy", pose: "sit", showMoon: false, entrance: "none", caption: "84 px · empty state" },
  { size: 104, mood: "cheer", pose: "sit", showMoon: false, entrance: "none", caption: "104 px · hasil lesson" },
  { size: 116, mood: "happy", pose: "wave", showMoon: true, entrance: "walk", caption: "116 px · onboarding — berjalan masuk" },
];

function primitiveToSvg(primitive: CatPrimitive): string {
  switch (primitive.kind) {
    case "path": {
      const stroke =
        primitive.stroke === undefined
          ? ""
          : ` stroke="${primitive.stroke}" stroke-width="${primitive.strokeWidth ?? 1}" stroke-linecap="${primitive.strokeLinecap ?? "butt"}"`;
      const opacity = primitive.opacity === undefined ? "" : ` opacity="${primitive.opacity}"`;
      return `<path d="${primitive.d}" fill="${primitive.fill ?? "none"}"${stroke}${opacity}/>`;
    }
    case "ellipse": {
      const opacity = primitive.opacity === undefined ? "" : ` opacity="${primitive.opacity}"`;
      return `<ellipse cx="${primitive.cx}" cy="${primitive.cy}" rx="${primitive.rx}" ry="${primitive.ry}" fill="${primitive.fill}"${opacity}/>`;
    }
    case "circle": {
      const opacity = primitive.opacity === undefined ? "" : ` opacity="${primitive.opacity}"`;
      return `<circle cx="${primitive.cx}" cy="${primitive.cy}" r="${primitive.r}" fill="${primitive.fill}"${opacity}/>`;
    }
    case "rect": {
      const rx = primitive.rx === undefined ? "" : ` rx="${primitive.rx}"`;
      return `<rect x="${primitive.x}" y="${primitive.y}" width="${primitive.width}" height="${primitive.height}"${rx} fill="${primitive.fill}"/>`;
    }
  }
}

/** Satu layer = satu `<div>` ber-transform-origin sendiri, sejajar dengan RN. */
function layerToHtml(layer: CatLayer): string {
  return (
    `<div class="layer l-${layer.id}" style="transform-origin:${layer.origin.x}% ${layer.origin.y}%">` +
    `<svg viewBox="0 0 ${ART} ${ART}">${layer.primitives.map(primitiveToSvg).join("")}</svg>` +
    `</div>`
  );
}

export type MascotTileInput = {
  mood: CatMood;
  pose: CatPose;
  variant?: CatVariant;
  size: number;
  showMoon?: boolean;
  entrance?: CatEntrance;
  caption: string;
  note?: string;
};

/** Tile tunggal: layer dari `catScene()` + kelas animasi yang cocok. */
export function mascotTile(input: MascotTileInput): string {
  const { mood, pose, size, caption, note } = input;
  const variant = input.variant ?? "ash";
  const layers = catScene({ mood, variant, pose, showMoon: input.showMoon ?? false });
  // Hanya tile bermata terbuka boleh berkedip — sama seperti komponen.
  const blink = layers.some((layer) => layer.id === "eyes" && layer.blinkable);
  const walking = (input.entrance ?? "none") === "walk";
  const shift = (size * CAT_MOTION.walkShift).toFixed(1);
  const classes = `mascot${blink ? " blink" : ""}${walking ? " walking" : ""}`;
  const captionHtml = note === undefined ? caption : `${caption} <small>${note}</small>`;

  return (
    `<figure class="tile">` +
    `<div class="stage"><div class="${classes}" style="width:${size}px;height:${size}px;--walk-shift:${shift}px">` +
    layers.map(layerToHtml).join("") +
    `</div></div>` +
    `<figcaption>${captionHtml}</figcaption>` +
    `</figure>`
  );
}

/** CSS halaman — semua durasi/amplitudo dibaca dari `CAT_MOTION`. */
function stylesheet(): string {
  const blinkCycle = CAT_MOTION.blinkPauseMs + CAT_MOTION.blinkCloseMs + CAT_MOTION.blinkOpenMs;
  const blinkStart = ((CAT_MOTION.blinkPauseMs / blinkCycle) * 100).toFixed(1);
  const blinkEnd = (((CAT_MOTION.blinkPauseMs + CAT_MOTION.blinkCloseMs) / blinkCycle) * 100).toFixed(1);
  const squash = (1 - CAT_MOTION.blinkSquash).toFixed(2);
  const tailDeg = CAT_MOTION.tailSwingDeg / 2;
  const waveDeg = CAT_MOTION.waveSwingDeg / 2;

  return `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; padding: 24px 28px 72px; background: #101820; color: #f2eee6; font: 14px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
h1 { font-size: 20px; margin: 0 0 4px; }
h2 { font-size: 15px; margin: 32px 0 10px; color: #e0b44a; letter-spacing: .02em; }
h3 { font-size: 13px; margin: 18px 0 8px; color: #9fb3c0; font-weight: 600; }
p { margin: 0 0 6px; max-width: 76ch; color: #c6d2d9; }
code { background: #1b2730; padding: 1px 5px; border-radius: 4px; font-size: 12px; }
small { color: #8fa0ab; }
.controls { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; margin: 14px 0 4px; padding: 12px 14px; border: 1px solid #26333d; border-radius: 10px; background: #16202a; }
button { font: inherit; padding: 7px 12px; border-radius: 8px; border: 1px solid #38505f; background: #1d2b35; color: inherit; cursor: pointer; }
button:hover { border-color: #e0b44a; }
label { display: flex; align-items: center; gap: 7px; cursor: pointer; }
.grid { display: flex; flex-wrap: wrap; gap: 10px; }
.tile { margin: 0; border: 1px solid #26333d; border-radius: 10px; background: #16202a; padding: 8px; width: calc(96px + 34px); }
.tile figcaption { font-size: 11px; line-height: 1.4; margin-top: 6px; color: #9fb3c0; }
.stage { display: grid; place-items: center; padding: 6px; }
.mascot { position: relative; }
.layer { position: absolute; inset: 0; }
.layer svg { display: block; width: 100%; height: 100%; overflow: visible; }
.tile.wide { width: auto; min-width: calc(116px + 34px); }

/* Gerak berulang: sama dengan loop di CatMascot.tsx. */
.l-tail { animation: tailSway ${CAT_MOTION.tailMs}ms ease-in-out infinite alternate; }
.l-body { animation: breathe ${CAT_MOTION.breatheMs}ms ease-in-out infinite alternate; }
.blink .l-eyes { animation: blinkEyes ${blinkCycle}ms linear infinite; }
.l-wave { animation: waveSwing ${CAT_MOTION.waveMs}ms ease-in-out infinite alternate; }
@keyframes tailSway { from { transform: rotate(${-tailDeg}deg); } to { transform: rotate(${tailDeg}deg); } }
@keyframes breathe { from { transform: translateY(0) scaleY(1); } to { transform: translateY(-1.8px) scaleY(1.018); } }
@keyframes blinkEyes { 0%, ${blinkStart}% { transform: scaleY(1); } ${blinkEnd}% { transform: scaleY(${squash}); } 100% { transform: scaleY(1); } }
@keyframes waveSwing { from { transform: rotate(${-waveDeg}deg); } to { transform: rotate(${waveDeg}deg); } }
/* Berjalan masuk: sekali, dua langkah kecil, lalu diam di tempat. */
.walking { animation: walkIn ${CAT_MOTION.walkMs}ms cubic-bezier(.33, 1, .68, 1) both; }
@keyframes walkIn {
  0% { opacity: 0; transform: translateX(calc(-1 * var(--walk-shift))) translateY(0); }
  25% { opacity: .75; transform: translateX(calc(-.75 * var(--walk-shift))) translateY(-${CAT_MOTION.walkHop}px); }
  50% { opacity: 1; transform: translateX(calc(-.5 * var(--walk-shift))) translateY(0); }
  75% { transform: translateX(calc(-.25 * var(--walk-shift))) translateY(-${CAT_MOTION.walkHop}px); }
  100% { opacity: 1; transform: translateX(0) translateY(0); }
}

/* Reduced-motion: tombol di bawah MENIRU useReducedMotion() milik app. */
body.no-motion .layer, body.no-motion .walking { animation: none !important; }
@media (prefers-reduced-motion: reduce) {
  .layer, .walking { animation: none !important; }
}
`;
}

/** Seluruh halaman pratinjau, siap ditulis ke berkas. */
export function buildMascotPreviewHtml(): string {
  const variantSections = CAT_VARIANTS.map((variant) => {
    const poses = CAT_POSES.map((pose) => {
      const tiles = CAT_MOODS.map((mood) =>
        mascotTile({
          mood,
          pose,
          variant,
          size: 96,
          caption: `${MOOD_LABEL[mood]}`,
          note: mood === "idle" || mood === "encourage" ? "· berkedip" : undefined,
        }),
      ).join("\n");
      return `<h3>${POSE_LABEL[pose]}</h3>\n<div class="grid">\n${tiles}\n</div>`;
    }).join("\n");
    return `<section>\n<h2>${VARIANT_LABEL[variant]}</h2>\n${poses}\n</section>`;
  }).join("\n");

  const sizeTiles = REAL_SIZE_PREVIEWS.map((entry) =>
    mascotTile({
      mood: entry.mood,
      pose: entry.pose,
      size: entry.size,
      showMoon: entry.showMoon,
      entrance: entry.entrance,
      caption: entry.caption,
    }),
  ).join("\n");

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pratinjau pose maskot — Meowalaf</title>
<style>${stylesheet()}</style>
</head>
<body>
<h1>Pratinjau pose &amp; animasi maskot — Abu</h1>
<p>
  Semua ${CAT_MOODS.length} mood × ${CAT_POSES.length} pose × ${CAT_VARIANTS.length} varian bulu, digambar langsung dari
  <code>catScene()</code> di <code>src/ui/cat-art.ts</code> — modul yang sama yang dipakai app
  (<code>CatMascot.tsx</code>). Durasi gerak dibaca dari <code>CAT_MOTION</code>, jadi halaman ini tidak bisa menyimpang
  dari yang dilihat user.
</p>
<div class="controls">
  <button id="replay" type="button">Putar ulang animasi masuk</button>
  <label><input id="no-motion" type="checkbox"> Matikan gerak (tiru <code>useReducedMotion()</code>)</label>
  <small>Di app, keputusan itu otomatis dari setelan OS.</small>
</div>

<h2>Ukuran nyata di app</h2>
<p>Termasuk animasi masuk <code>entrance="walk"</code> (sekali saja, saat maskot pertama muncul).</p>
<div class="grid">${sizeTiles}</div>

${variantSections}

<h2>Angka gerak (CAT_MOTION)</h2>
<p>
  Ekor ${CAT_MOTION.tailMs} ms (cheer ${CAT_MOTION.cheerTailMs} ms) · napas ${CAT_MOTION.breatheMs} ms (cheer
  ${CAT_MOTION.cheerBreatheMs} ms) · kedip: jeda ${CAT_MOTION.blinkPauseMs} ms, tutup ${CAT_MOTION.blinkCloseMs} ms,
  buka ${CAT_MOTION.blinkOpenMs} ms · lambaian ${CAT_MOTION.waveMs} ms (± ${CAT_MOTION.waveSwingDeg / 2}°) · berjalan
  masuk ${CAT_MOTION.walkMs} ms.
</p>
<p>
  Layer: <code>tail</code> · <code>body</code> · <code>eyes</code> · <code>wave</code> (hanya pose <code>wave</code>).
</p>
<script>
var replay = document.getElementById("replay");
if (replay) {
  replay.addEventListener("click", function () {
    document.querySelectorAll(".walking").forEach(function (node) {
      node.classList.remove("walking");
      void node.offsetWidth;
      node.classList.add("walking");
    });
  });
}
var toggle = document.getElementById("no-motion");
if (toggle) {
  toggle.addEventListener("change", function () {
    document.body.classList.toggle("no-motion", toggle.checked);
  });
}
</script>
</body>
</html>
`;
}

/**
 * Script inline untuk harness reduced-motion.
 *
 * Dua hal, keduanya harus terjadi SEBELUM script `defer` berjalan (maka ditulis
 * inline, bukan file terpisah):
 *   1. `matchMedia` dipaksa melaporkan `prefers-reduced-motion: reduce`.
 *   2. `history.replaceState('/')` — halaman harness ada di `/_brand/...`, jadi
 *      router akan menganggapnya rute tak dikenal dan tampilkan "halaman ilang".
 *      Mengganti URL TANPA memuat ulang dokumen tetap membawa override-nya.
 */
const FORCED_REDUCED_MOTION_SCRIPT =
  "<script>(function(){var real=window.matchMedia.bind(window);window.matchMedia=function(q){if(typeof q==='string'&&q.indexOf('prefers-reduced-motion')!==-1){return{matches:true,media:q,onchange:null,addEventListener:function(){},removeEventListener:function(){},addListener:function(){},removeListener:function(){},dispatchEvent:function(){return false;}};}return real(q);};history.replaceState(null,'','/');})();</script>";

/**
 * Salinan `dist/index.html` dengan override reduced-motion, supaya kondisi
 * "user minta gerak diminimalkan" bisa diuji di browser biasa.
 *
 * Kenapa tidak cukup override dari console: `useReducedMotion()` membaca setelan
 * OS saat modul Reanimated pertama kali dimuat — override yang dipasang setelah
 * app berjalan sudah terlambat, dan mengubah setelan OS di mesin QA bukan
 * langkah yang wajar. Semua path aset di `index.html` itu absolut, jadi salinan
 * di `_brand/` tetap memuat bundle yang sama persis.
 */
export function withForcedReducedMotion(indexHtml: string): string {
  const anchor = '<div id="root"></div>';
  if (!indexHtml.includes(anchor)) {
    throw new Error("dist/index.html tidak punya #root — tidak bisa menyisipkan override reduced-motion");
  }
  return indexHtml.replace(anchor, `${anchor}\n    ${FORCED_REDUCED_MOTION_SCRIPT}`);
}

function main(): void {
  const target = process.argv[2] ?? path.join("dist", "_brand", "mascot-preview.html");
  const outPath = path.resolve(process.cwd(), target);
  const html = buildMascotPreviewHtml();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, "utf8");
  const relative = path.relative(process.cwd(), outPath).split(path.sep).join("/");
  const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(1);
  console.log(`pratinjau pose maskot -> ${relative} (${kb} KB)`);

  const indexPath = path.resolve(process.cwd(), "dist", "index.html");
  if (fs.existsSync(indexPath)) {
    const harnessPath = path.join(path.dirname(outPath), "app-reduced-motion.html");
    fs.writeFileSync(harnessPath, withForcedReducedMotion(fs.readFileSync(indexPath, "utf8")), "utf8");
    console.log(`harness reduced-motion -> ${path.relative(process.cwd(), harnessPath).split(path.sep).join("/")}`);
  } else {
    console.log("lewati harness reduced-motion: dist/index.html belum ada (jalankan npm run export:web dulu)");
  }

  console.log("buka: http://127.0.0.1:8132/_brand/mascot-preview  (setelah npm run export:web + serve:web)");
  console.log("mode diam: http://127.0.0.1:8132/_brand/app-reduced-motion");
}

const invokedDirectly = process.argv[1] !== undefined && /mascot-preview\.[cm]?ts$/.test(process.argv[1]);
if (invokedDirectly) main();
