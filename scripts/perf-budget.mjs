/**
 * Ukur performa app terhadap budget RULES.md § 9. Tanpa dependency: Node 20
 * (`node --experimental-websocket` tidak dipakai di sini) + Chrome headless.
 *
 * Cara kerjanya, dan kenapa angka di sini bisa dipercaya:
 *   1. Ukuran bundle dihitung dari file NYATA di dist/ (gzip per berkas).
 *   2. App disajikan lewat server statis yang menunda & membatasi bandwidth,
 *      jadi "4G throttled" bukan asumsi tapi link yang benar-benar dibuat.
 *   3. Chrome headless membuka app dengan profil kosong (cache kosong, OPFS
 *      kosong) lalu skrip injeksi menjalankan alur nyata: onboarding → Home →
 *      lesson → putar audio → animasi layar hasil, lalu mengirim timing-nya
 *      balik ke server.
 *   4. Server mencetak tabel lulus/gagal per metrik.
 *
 * Jalankan:  node scripts/perf-budget.mjs
 * Opsi:       --keep    jangan hapus profil Chrome setelah selesai
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

/**
 * Budget RULES.md § 9 (versi setelah ADR-008).
 *
 * Setiap metrik waktu punya SATU profil link target, karena angka di link berbeda
 * beda DEVICE tidak sebanding: startup diuji di Fast 4G, first paint di Slow 4G.
 * Di profil selain target, angka tetap ditampilkan tapi verdict-nya "-" supaya
 * terlihat tanpa dipakai sebagai alasan "lolos".
 *
 * Kenapa tidak lagi Slow 4G < 2 s: secara fisik tidak mungkin dicapai. 0,92 MB
 * harus turun sebelum Home tampil; pada 200 KB/s itu 4,6 detik transfer saja,
 * tanpa parse, tanpa render. Lihat ADR-008 untuk hitungannya.
 */
const BUDGET = {
  startup: { profile: "fast4g", ms: 5000, label: "Fast 4G" },
  firstPaint: { profile: "slow4g", ms: 10000, label: "Slow 4G" },
  lesson: { profile: "fast4g", ms: 2000, label: "Fast 4G" },
  audioMs: 500,
  // 8 MB dulu tidak pernah menangkap apa pun (terukur 1,98 MB). Sekarang byte
  // jadi penjaga utama, karena tidak ada lagi budget waktu di link lambat.
  bundleGzipBytes: 3 * 1024 * 1024,
  dropFramePct: 5,
};

/**
 * Profil link. Angka Slow/Fast 4G sama persis dengan yang dipakai Lighthouse,
 * jadi "4G throttled" di RULES § 9 punya arti yang bisa dibandingkan dengan
 * alat lain. "none" = tanpa throttling (langit-langit lokal).
 */
const LINK_PRESETS = [
  { id: 'slow4g', label: 'Slow 4G (Lighthouse: 150 ms RTT, 1.6 Mbps)', latencyMs: 150, downBytesPerSecond: 200 * 1024 },
  { id: 'fast4g', label: 'Fast 4G (Lighthouse: 9 ms RTT, 9.2 Mbps)', latencyMs: 9, downBytesPerSecond: Math.round(9.2 * 1024 * 1024 / 8) },
  { id: 'none', label: 'tanpa throttling (localhost)', latencyMs: 0, downBytesPerSecond: Infinity },
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
};

/**
 * Ekstensi yang dikompresi server produksi (Vercel/Netlify/CDN) dan karena itu HARUS
 * dikompresi di sini juga.
 *
 * Kenapa ini penting: run pertama (3 Okt 2026) mengukur "startup 52 detik di Slow 4G"
 * memakai server yang mengirim berkas mentAH. Entry chunk 8,5 MB mentah / 200 KB/s =
 * 42 detik hanya untuk transfer, tanpa hitungan parse. Angka itu mengukur `serve dist`,
 * bukan Vercel. Sekarang server di skrip ini memperlakukan gzip seperti CDN sungguhan
 * dan melaporkan byte yang benar-benar turun di kabel (wire) DAN byte mentahnya,
 * supaya tidak ada lagi angka yang terlihat lebih bagus dari kenyataan. Nonaktifkan
 * kompresi lewat --no-compression.
 */
const COMPRESSIBLE = new Set([".html", ".js", ".css", ".json", ".wasm", ".svg", ".map"]);

/**
 * Pembatas bandwidth BERSAMA (satu pipa untuk semua koneksi).
 *
 * Link sungguhan itu satu jalur: browser membuka 6 koneksi paralel ke host yang sama,
 * dan semua itu berbagi throughput. Versi pertama skrip ini men-throttle per koneksi,
 * jadi 6 request paralel berjalan 6x lebih cepat dari kenyataan -- angka startup jadi
 * terlihat bagus tanpa alasan. Di sini satu scheduler membagi byte ke semua response
 * yang masih aktif (round-robin) dengan langkah waktu tetap, persis seperti pipa yang
 * diperebutkan banyak koneksi.
 */
function createLinkShaper(bytesPerSecond) {
  const STEP_MS = 10;
  const streams = new Set();
  let cursor = 0;
  let credit = 0;
  let timer = null;

  const tick = () => {
    if (!Number.isFinite(bytesPerSecond)) return;
    credit = Math.min(credit + (bytesPerSecond * STEP_MS) / 1000, bytesPerSecond * 0.25);
    if (streams.size === 0) {
      credit = 0;
      return;
    }
    const list = [...streams];
    for (let n = 0; n < list.length && credit > 0; n += 1) {
      const stream = list[(cursor + n) % list.length];
      credit -= stream.pump(credit);
    }
    cursor = (cursor + 1) % list.length;
  };

  return {
    add(stream) {
      streams.add(stream);
      if (timer === null) timer = setInterval(tick, STEP_MS);
    },
    remove(stream) {
      streams.delete(stream);
      if (streams.size === 0 && timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
    stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      streams.clear();
    },
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2);

// ---------------------------------------------------------------------------
// 1. Ukuran bundle (dari disk, nyata).
// ---------------------------------------------------------------------------

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function measureBundle() {
  const files = walk(DIST);
  const rows = [];
  let raw = 0;
  let gzip = 0;
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (![".html", ".js", ".css", ".json", ".ttf", ".png", ".ico", ".wasm"].includes(ext)) continue;
    const body = fs.readFileSync(file);
    const zipped = zlib.gzipSync(body, { level: 9 }).length;
    const rel = path.relative(DIST, file).replace(/\\/g, "/");
    rows.push({ rel, ext, raw: body.length, gzip: zipped });
    raw += body.length;
    gzip += zipped;
  }
  rows.sort((a, b) => b.gzip - a.gzip);
  return { rows, raw, gzip };
}

// ---------------------------------------------------------------------------
// 2. Skrip yang disuntikkan ke index.html saat ?perf=1.
// ---------------------------------------------------------------------------

const DRIVER = `
(async function () {
  const post = (payload) =>
    fetch('/__perf', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Semua yang diukur di sini memakai data-testid, BUKAN teks tombol. Semua label
  // sudah masuk kamus (core/i18n), jadi kalau harness mencari "Lanjut Ngaji" atau
  // "Mulai Latihan" maka ia mengukur terjemahan, bukan performa - dan begitu
  // profilnya English (atau copy-nya dikoreksi sedikit) harness melaporkan 15 s
  // timeout sebagai "lesson lambat". testID tidak ikut berubah saat bahasa ganti.
  const byTestId = (id) => document.querySelector('[data-testid="' + id + '"]');
  const allTestIds = (prefix) =>
    Array.from(document.querySelectorAll('[data-testid^="' + prefix + '"]'));
  const waitFor = async (fn, timeout) => {
    const deadline = performance.now() + timeout;
    while (performance.now() < deadline) {
      const hit = fn();
      if (hit) return hit;
      await sleep(60);
    }
    return null;
  };
  // Tombol yang SUDAH bisa ditekan. sejak ADR-009 tombol "Lanjut Ngaji"
  // sengaja disabled sampai repo progres siap (lihat hydration-store), jadi
  // skrip harus menungguiu - persis seperti user yang membaca Home dulu.
  const enabled = (id) => {
    const el = byTestId(id);
    if (!el) return null;
    return el.getAttribute('aria-disabled') === 'true' ? null : el;
  };
  const nav = () => performance.getEntriesByType('navigation')[0] || {};

  const out = { ua: navigator.userAgent, steps: [] };
  try {
    const skip = await waitFor(() => enabled('onboarding-skip'), 120000);
    if (skip) { out.steps.push('onboarding dilewati'); skip.click(); }
    const go = await waitFor(() => byTestId('home-continue'), 120000);
    if (!go) throw new Error('Home tidak muncul');
    out.startupMs = performance.now();
    out.timing = {
      domContentLoaded: Math.round(nav().domContentLoadedEventEnd || 0),
      loadEvent: Math.round(nav().loadEventEnd || 0),
      transferBytes: performance.getEntriesByType('resource').reduce((s2, e) => s2 + (e.transferSize || 0), 0),
    };
    // Paint timing dipakai untuk budget "first paint" (RULES.md § 9). Di web,
    // first-contentful-paint = saat frame pertama benar-benar ada di layar; kalau
    // angka ini mendekati startupMs, artinya tidak ada yang bisa dicatat lebih awal
    // karena layar splash kosong sampai font + SQLite siap.
    const paints = {};
    for (const entry of performance.getEntriesByType('paint')) {
      paints[entry.name] = Math.round(entry.startTime);
    }
    out.paint = { firstPaintMs: paints['first-paint'], fcpMs: paints['first-contentful-paint'] };
    // Kapan CTA jadi bisa ditekan (informational): ini waktu tunggu storage,
    // bukan waktu render - dipisah supaya tidak tercampur dalam angka startup.
    //
    // Sambil menunggu, periksa juga janji ADR-009: selama repo belum siap,
    // Home WAJIB menampilkan placeholder dan TIDAK BOLEH menampilkan angka 0
    // seolah-olah itu fakta. Ini satu-satunya tempat di repo yang bisa
    // membuktikan janji itu di browser sungguhan, bukan cuma lewat unit test.
    //
    // Hanya widget yang BERASAL dari SQLite yang boleh jadi sinyal, jadi daftar ini
    // memakai testID (lihat catatan di atas), bukan kalimat yang bisa berubah.
    // Angka quest ("0/25") sengaja TIDAK masuk daftar: quest itu AsyncStorage,
    // jadi nilainya benar sejak awal dan tidak pernah di-skeleton.
    const FAKE_ZERO_TOKENS = ['home-streak', 'home-level', 'home-progress-ring'];
    // Definisi "flash" yang dipakai di sini bukan "angka 0 terlihat", tapi
    // URUTAN yang salah. Pada profil baru "Level 0" itu fakta yang benar, jadi
    // kemunculannya saja bukan pelanggaran. Pelanggaran yang sebenarnya:
    //   a) angka nyata muncul LEBIH DAHULU dari placeholder, lalu placeholder
    //      menyusul - itu persis flash yang dilarang ADR-009; atau
    //   b) angka dan placeholder hidup BERSAMAAN - satu widget lupa
    //      consulting isProgressLoading, jadi sebagian Home sudah "tahu".
    // Kalau placeholder tidak pernah muncul sama sekali, storage sudah siap
    // sebelum Home melukis: tidak ada yang perlu Placeholder, jadi bukan flash.
    const watchStart = performance.now();
    let firstRealMs = null;
    let firstPlaceholderMs = null;
    let mixedState = null;
    const at = () => Math.round(performance.now() - watchStart);
    while (performance.now() - watchStart < 30000) {
      const token = FAKE_ZERO_TOKENS.map((id) => byTestId(id)).find(Boolean) || null;
      const placeholderVisible = byTestId('home-progress-placeholder') !== null;
      if (placeholderVisible && firstPlaceholderMs === null) firstPlaceholderMs = at();
      if (token && firstRealMs === null) firstRealMs = at();
      if (placeholderVisible && token && mixedState === null) {
        mixedState = { token: token.getAttribute('data-testid'), atMs: at() };
      }
      if (enabled('home-continue')) break;
      await sleep(60);
    }
    const outOfOrder = firstRealMs !== null && firstPlaceholderMs !== null && firstRealMs < firstPlaceholderMs;
    const sawPlaceholder = firstPlaceholderMs !== null;
    const fakeZero = mixedState || (outOfOrder ? { token: 'placeholder menyusul angka', atMs: firstPlaceholderMs } : null);
    out.placeholderShownWhileLoading = sawPlaceholder;
    out.fakeZeroWhileLoading = fakeZero;
    const cta = await waitFor(() => enabled('home-continue'), 60000);
    out.ctaEnabledMs = cta === null ? null : Math.round(performance.now());
    const slowest = performance.getEntriesByType('resource')
      .filter((e) => e.duration > 50)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 6)
      .map((e) => e.name.split('/').slice(-1)[0] + ' ' + Math.round(e.duration) + 'ms');
    out.slowest = slowest;
    out.steps.push('home siap');

    // Layar lesson: klik berulang — hydration bisa belum siap saat Home muncul.
    // "siap" = sudah DI LUAR fase memuat teks Quran (loading/failed) dan fase
    // not-found, jadi layar materi benar-benar terpasang. TestID, bukan "MATERI".
    const lessonReady = () =>
      location.pathname.indexOf('/lesson/') === 0 && byTestId('lesson-phase-materi') !== null;
    const t0 = performance.now();
    let lessonOk = false;
    // Batasnya 40 s: di link lambat CTA bisa disabled beberapa detik karena
    // SQLite masih dibuka di belakang layar. Sambil menunggu, jangan bakar
    // waitFor 15 s per percobaan seperti versi lama - itu mengukur timeout,
    // bukan performa.
    const lessonDeadline = t0 + 40000;
    while (performance.now() < lessonDeadline && !lessonOk) {
      const button = enabled('home-continue');
      if (button) {
        button.click();
        lessonOk = Boolean(await waitFor(lessonReady, 15000));
        if (!lessonOk) await sleep(200);
      } else {
        await sleep(200);
      }
    }
    if (!lessonOk) {
      out.lessonError = 'layar lesson tidak muncul setelah 4x klik';
      out.lessonDebug = { path: location.pathname, body: document.body.innerText.slice(0, 160) };
    }
    else { out.lessonMs = performance.now() - t0; out.steps.push('lesson siap'); }
    // Chunk teks Quran (ADR-007) comparatively dengan saat user menekan CTA.
    // Kalau baru selesai SETELAH klik, maka layar lesson memang menunggu
    // jaringan - dan itu menjelaskan sebagian besar latensi lesson dengan sendirinya.
    const textChunk = performance
      .getEntriesByType('resource')
      .find((e) => e.name.indexOf('loader-') >= 0);
    out.textChunk = textChunk
      ? {
          readyMs: Math.round(textChunk.responseEnd),
          sudahSiapSebelumKlik: textChunk.responseEnd < t0,
          waitedMs: Math.round(Math.max(0, performance.now() - t0) - Math.min(textChunk.responseEnd, t0)),
        }
      : { note: 'chunk teks tidak diminta sama sekali' };

    // Audio ayat.
    const play = await waitFor(() => byTestId('lesson-audio-1'), 20000);
    if (play) {
      const tClick = performance.now();
      play.click();
      const entry = await waitFor(() => {
        const list = performance
          .getEntriesByType('resource')
          .filter((e) => e.name.indexOf('.mp3') >= 0 && e.startTime >= tClick - 50);
        return list.length > 0 ? list[list.length - 1] : null;
      }, 30000);
      if (entry) {
        // Resource dari cache punya responseStart = 0, jadi pakai startTime.
        const firstByte = entry.responseStart > 0 ? entry.responseStart : entry.startTime;
        out.audio = {
          ttfbMs: Math.round(firstByte - tClick),
          loadedMs: Math.round(entry.responseEnd - tClick),
          fromCache: entry.transferSize === 0,
          bytes: entry.transferSize,
          url: entry.name.split('/').pop(),
        };
        out.steps.push('audio ' + out.audio.url);
      }
      await sleep(1200);
      out.audioDebug = performance
        .getEntriesByType('resource')
        .filter((e) => e.name.indexOf('.mp3') >= 0)
        .map((e) => ({
          file: e.name.split('/').pop(),
          start: Math.round(e.startTime),
          ttfb: Math.round(e.responseStart),
          end: Math.round(e.responseEnd),
        }));
      out.clickAt = Math.round(tClick);
    }

    // Selesaikan lesson (akurasi tidak penting di sini) lalu ukur animasi.
    // Sama seperti di atas: semua lewat testID. Harness harus tetap jalan kalau
    // copy Indonesia diganti, atau kalau profilnya English.
    const deadline = performance.now() + 120000;
    while (performance.now() < deadline) {
      if (byTestId('lesson-result')) break;
      const mulai = enabled('lesson-start-practice');
      if (mulai) { mulai.click(); await sleep(400); continue; }
      const cek = enabled('lesson-check');
      const next = byTestId('lesson-next');
      if (cek) {
        const options = allTestIds('lesson-answer-');
        if (options.length > 0) options[0].click();
        cek.click();
        await sleep(260);
        continue;
      }
      if (next) { next.click(); await sleep(260); continue; }
      await sleep(200);
    }
    out.steps.push('lesson selesai');

    out.frames = await new Promise((resolve) => {
      let total = 0;
      let long = 0;
      let worst = 0;
      let last = performance.now();
      const start = last;
      const tick = (now) => {
        const delta = now - last;
        last = now;
        total += 1;
        if (delta > 50) long += 1;
        if (delta > worst) worst = delta;
        if (now - start < 4000) requestAnimationFrame(tick);
        else resolve({ total, long, worstMs: Math.round(worst), dropPct: total ? (long / total) * 100 : 0 });
      };
      requestAnimationFrame(tick);
    });
  } catch (error) {
    out.error = String(error && error.message ? error.message : error);
  }
  await post(out);
})();
`;

// ---------------------------------------------------------------------------
// 3. Server statis + pengukur.
// ---------------------------------------------------------------------------

function startServer(port, link) {
  // Urutan arrival di sisi server. Resource Timing di halaman TIDAK bisa melihat
  // permintaan yang dibuat di dalam Web Worker - dan justru Web Worker yang
  // mengambil wasm SQLite. Jadi untuk membuktikan wasm keluar dari jalur paint,
  // satu-satunya sumber yang jujur adalah server: ia melihat semua permintaan,
  // dari halaman maupun worker.
  const state = { result: null, wireBytes: 0, rawBytes: 0, arrivals: [], t0: Date.now() };
  const compressionEnabled = !process.argv.includes("--no-compression");
  const shaper = createLinkShaper(link.downBytesPerSecond);
  // gzip dihitung sekali per berkas: bundle 13 MB, di-throttle 200 KB/s, jangan
  // mengulang kompresi di tengah pengukuran.
  const gzipped = new Map();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname !== "/__perf") {
      state.arrivals.push({ at: Date.now() - state.t0, name: url.pathname.split("/").slice(-1)[0] || url.pathname });
    }

    if (url.pathname === "/__perf" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try { state.result = JSON.parse(body); } catch { state.result = { error: 'payload rusak' }; }
        res.writeHead(204).end();
      });
      return;
    }

    let rel = decodeURIComponent(url.pathname);
    if (rel === "/") rel = "/index.html";
    const file = path.join(DIST, rel);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { "content-type": "text/plain" }).end("404");
      return;
    }

    let body = fs.readFileSync(file);
    const ext = path.extname(file).toLowerCase();

    if (ext === ".html") {
      body = Buffer.from(
        body.toString("utf8").replace("</body>", "<script>" + DRIVER + "</script></body>"),
      );
    }

    // Server produksi (Vercel) mengirim gzip/brotli, dan Chrome juga mengirim
    // Accept-Encoding. Tanpa ini, angka transfer hanya mengukur `serve dist`,
    // bukan yang dialami user sungguhan.
    const acceptsGzip = /\bgzip\b/.test(req.headers["accept-encoding"] || "");
    const useGzip = compressionEnabled && acceptsGzip && COMPRESSIBLE.has(ext);
    let payload = body;
    if (useGzip) {
      let cached = gzipped.get(file);
      if (cached === undefined) {
        cached = zlib.gzipSync(body, { level: 9 });
        gzipped.set(file, cached);
      }
      payload = cached;
    }

    // Tunda respons setengah RTT (latensi), lalu kirim lewat pipa bandwidth bersama.
    const delay = link.latencyMs / 2;
    setTimeout(() => {
      const headers = {
        "content-type": MIME[ext] || "application/octet-stream",
        "cache-control": "no-store",
        vary: "accept-encoding",
      };
      if (useGzip) headers["content-encoding"] = "gzip";
      res.writeHead(200, headers);
      state.wireBytes += payload.length;
      state.rawBytes += body.length;

      let offset = 0;
      let paused = false;
      const stream = {
        /** Kirim paling banyak `budget` byte; return byte yang benar-benar terpakai. */
        pump(budget) {
          if (paused || offset >= payload.length) return 0;
          const size = Math.min(Math.floor(budget), payload.length - offset, 64 * 1024);
          const flushed = res.write(payload.subarray(offset, offset + size));
          offset += size;
          if (!flushed) {
            paused = true;
            res.once("drain", () => {
              paused = false;
            });
          }
          if (offset >= payload.length) {
            res.end();
            shaper.remove(stream);
          }
          return size;
        },
      };
      if (offset >= payload.length) {
        res.end();
        return;
      }
      if (!Number.isFinite(link.downBytesPerSecond)) {
        res.end(payload); // tanpa throttling: kirim utuh, tanpa scheduler
        return;
      }
      shaper.add(stream);
    }, delay);
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve({ server, state, shaper }));
  });
}

// ---------------------------------------------------------------------------
// 4. Chrome.
// ---------------------------------------------------------------------------

const CHROME_CANDIDATES = [
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

function findChrome() {
  for (const candidate of CHROME_CANDIDATES) if (fs.existsSync(candidate)) return candidate;
  throw new Error("Chrome/Edge tidak ditemukan di path standar");
}

/** Jalankan satu profil link dari awal sampai akhir dengan Chrome headless baru. */
async function measureLink(preset, port) {
  const { server, state, shaper } = await startServer(port, preset);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ayatin-perf-"));
  const chrome = spawn(
    findChrome(),
    [
      "--headless=new",
      "--disable-gpu",
      "--mute-audio",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-sync",
      "--user-data-dir=" + profile,
      "http://127.0.0.1:" + port + "/",
    ],
    { stdio: "ignore" },
  );

  const deadline = Date.now() + 300000;
  while (!state.result && Date.now() < deadline) await sleep(250);

  chrome.kill();
  server.close();
  shaper.stop();

  const result = state.result || { error: "browser tidak mengirim hasil dalam 300 detik" };
  result.served = { wireBytes: state.wireBytes, rawBytes: state.rawBytes };
  // Kapan SQLite benar-benar diminta di kabel. Waktu arrival ini diukur relatif
  // terhadap request PERTAMA (bukan navigationStart), sedangkan FCP diukur
  // terhadap start dokumen - jadi keduanya dibandingkan lewat selisih window
  // awal, bukan angka mentah.
  const wasmHit = state.arrivals.find((a) => a.name.indexOf("wa-sqlite") >= 0);
  const docs = state.arrivals.filter((a) => a.name === "" || a.name.indexOf(".") < 0);
  result.wasmRequest = wasmHit
    ? {
        atMs: wasmHit.at,
        setelahDokumenMs: wasmHit.at - (docs.length ? docs[0].at : 0),
      }
    : { note: "tidak ada permintaan wa-sqlite" };
  result.requestCount = state.arrivals.length;

  if (!process.argv.includes("--keep")) {
    await sleep(600);
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    } catch {
      /* Chrome masih memegang berkas profil; tidak menggagalkan run. */
    }
  }
  return result;
}

function buildRows(bundle, result, presetId) {
  const verdict = (value, budget) => {
    if (value === undefined || value === null || Number.isNaN(value)) return "TIDAK TERUKUR";
    return value < budget ? "LULUS" : "GAGAL";
  };
  // Metrik dengan budget per-profil: di luar profil target angkanya tetap
  // ditampilkan, tapi tidak diberi LULUS/GAGAL supaya tidak dipakai sebagai
  // alasan lolos di link yang memang tidak jadi target.
  const scopedVerdict = (value, spec) => {
    if (presetId !== spec.profile) return "-";
    return verdict(value, spec.ms);
  };
  const scopedBudget = (spec) => `< ${spec.ms} ms (${spec.label} saja)`;
  return [
    {
      metrik: "Startup -> Home interaktif (cache kosong)",
      angka: result.startupMs === undefined ? null : Math.round(result.startupMs) + " ms",
      budget: scopedBudget(BUDGET.startup),
      hasil: scopedVerdict(result.startupMs, BUDGET.startup),
    },
    {
      metrik: "First contentful paint (tampilan pertama)",
      angka: result.paint && result.paint.fcpMs !== undefined && result.paint.fcpMs !== null
        ? result.paint.fcpMs + " ms"
        : null,
      budget: scopedBudget(BUDGET.firstPaint),
      hasil: scopedVerdict(result.paint && result.paint.fcpMs, BUDGET.firstPaint),
    },
    {
      metrik: "CTA Home aktif (tunggu storage)",
      angka: result.ctaEnabledMs === undefined || result.ctaEnabledMs === null ? null : result.ctaEnabledMs + " ms",
      budget: "(tidak ada budget; informational)",
      hasil: "-",
    },
    {
      metrik: "Placeholder tampil selama tunggu storage (ADR-009)",
      angka: result.placeholderShownWhileLoading === undefined
        ? null
        : (result.placeholderShownWhileLoading ? "ya" : "tidak terlihat") +
          " · angka 0 palsu: " +
          (result.fakeZeroWhileLoading === undefined
            ? "tidak diperiksa"
            : result.fakeZeroWhileLoading === null
              ? "tidak ada"
              : "ADA (" + result.fakeZeroWhileLoading.token + ")"),
      budget: "placeholder yes, angka 0 tidak",
      hasil:
        result.placeholderShownWhileLoading === undefined
          ? "TIDAK TERUKUR"
          : result.fakeZeroWhileLoading === null
            ? "LULUS"
            : "GAGAL",
    },
    {
      metrik: "Buka layar lesson -> interaktif (dari CTA aktif)",
      // Chunk teks ikut dilaporkan di baris yang sama: kalau baris ini jelek
      // sementara teks sudah siap sebelum diklik, penyebabnya bukan teks.
      angka:
        result.lessonMs === undefined
          ? null
          : Math.round(result.lessonMs) +
            " ms · teks Quran " +
            (result.textChunk === undefined
              ? "tidak diukur"
              : result.textChunk.note ||
                (result.textChunk.sudahSiapSebelumKlik ? "sudah siap" : "BARU masuk setelah klik")),
      budget: scopedBudget(BUDGET.lesson),
      hasil: scopedVerdict(result.lessonMs, BUDGET.lesson),
    },
    {
      metrik: "Play audio ayat -> byte pertama",
      angka: result.audio ? result.audio.ttfbMs + " ms (" + result.audio.url + ")" : null,
      budget: "< 500 ms",
      hasil: verdict(result.audio && result.audio.ttfbMs, BUDGET.audioMs),
    },
    {
      metrik: "Play audio ayat -> file selesai diunduh",
      angka: result.audio ? result.audio.loadedMs + " ms" : null,
      budget: "(tidak ada budget; informational)",
      hasil: "-",
    },
    {
      metrik: "Drop frame saat animasi layar hasil",
      angka: result.frames
        ? result.frames.dropPct.toFixed(2) + "% (" + result.frames.long + "/" + result.frames.total + " frame > 50 ms)"
        : null,
      budget: "< 5%",
      hasil: verdict(result.frames && result.frames.dropPct, BUDGET.dropFramePct),
    },
  ];
}

function printTable(rows, title) {
  console.log("\n" + title);
  console.log("-".repeat(118));
  for (const row of rows) {
    console.log(
      (row.metrik + " ".repeat(42)).slice(0, 42) +
        " | " +
      String(row.angka).padEnd(32) +
        " | " +
      row.budget.padEnd(28) +
        " | " +
      row.hasil,
    );
  }
}

async function run() {
  if (!fs.existsSync(DIST)) {
    console.error("dist/ belum ada - jalankan: npx expo export --platform web");
    process.exit(1);
  }

  const bundle = measureBundle();
  console.log("\n=== PERFORMA vs RULES.md § 9 ===");
  console.log("\nBundle web (dari file nyata di dist/):");
  console.log("  total          : " + mb(bundle.raw) + " MB mentah -> " + mb(bundle.gzip) + " MB gzip");
  console.log("  budget         : < " + mb(BUDGET.bundleGzipBytes) + " MB gzip (RULES.md § 9)");
  console.log("  hasil          : " + (bundle.gzip < BUDGET.bundleGzipBytes ? "LULUS" : "GAGAL"));
  console.log("\n  10 berkas terbesar (gzip):");
  for (const row of bundle.rows.slice(0, 10)) {
    console.log("    " + (row.rel + " ".repeat(54)).slice(0, 54) + " | " + mb(row.gzip) + " MB");
  }

  const only = (process.argv.find((a) => a.startsWith("--link=")) || "").split("=")[1];
  const presets = only ? LINK_PRESETS.filter((p) => p.id === only) : LINK_PRESETS;
  if (presets.length === 0) {
    console.error("--link tidak dikenal: " + only);
    process.exit(1);
  }

  let port = 8133;
  const summary = [];
  for (const preset of presets) {
    console.log("\n--- mengukur: " + preset.label + " ---");
    const result = await measureLink(preset, port);
    port += 1;
    printTable(buildRows(bundle, result, preset.id), "  " + preset.label);
    if (result.error) console.log("  CATATAN: " + result.error);
    if (result.timing) {
      console.log(
        "  DCL " + result.timing.domContentLoaded + " ms | load " + result.timing.loadEvent + " ms | transfer " + mb(result.timing.transferBytes) + " MB",
      );
    }
    if (result.served) {
      console.log(
        "  yang benar-benar dikirim server: " + mb(result.served.wireBytes) + " MB di kabel (gzip) / " +
          mb(result.served.rawBytes) + " MB mentah",
      );
    }
    if (result.steps) console.log("  langkah: " + result.steps.join(" | "));
    if (result.wasmRequest) {
      const w = result.wasmRequest;
      console.log(
        "  permintaan wa-sqlite: " +
          (w.note || "arrival " + w.atMs + " ms, " + w.setelahDokumenMs + " ms setelah dokumen tiba") +
          " (total " + result.requestCount + " permintaan)",
      );
    }
    if (result.slowest) console.log("  resource terslow: " + result.slowest.join(", "));
    if (result.lessonError) console.log("  lessonError: " + result.lessonError + " | " + JSON.stringify(result.lessonDebug));
    if (result.audioDebug) console.log("  audioDebug: klik@" + result.clickAt + " " + JSON.stringify(result.audioDebug));
    summary.push({ preset: preset.label, result });
  }

  console.log("\n=== RINGKASAN ===");
  for (const row of summary) {
    const startup = row.result.startupMs === undefined ? "n/a" : Math.round(row.result.startupMs) + " ms";
    const fcp = row.result.paint && row.result.paint.fcpMs ? row.result.paint.fcpMs + " ms" : "n/a";
    console.log(
      "  " + (row.preset + " ".repeat(40)).slice(0, 40) + " -> first paint " + (fcp + "        ").slice(0, 12) +
        " Home " + startup,
    );
  }
  for (const row of summary) {
    const zero = row.result.fakeZeroWhileLoading;
    if (zero !== undefined && zero !== null) {
      console.log("  PERINGATAN ADR-009: angka 0 tampil sebelum storage siap (" + zero.token + " @" + zero.atMs + " ms)");
    }
  }
  console.log("  budget target: startup & lesson di " + BUDGET.startup.label + ", first paint di " +
    BUDGET.firstPaint.label + " (RULES.md § 9, ADR-008). Slow 4G punya budget byte, bukan budget waktu.");
  console.log("");
}

await run();
