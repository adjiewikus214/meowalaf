import { describe, expect, it } from "vitest";

import { CAT_MOODS, CAT_POSES, CAT_VARIANTS } from "../../src/ui/cat-art";
import { REAL_SIZE_PREVIEWS, buildMascotPreviewHtml, mascotTile, withForcedReducedMotion } from "./mascot-preview";

/**
 * Pratinjau pose adalah alat QA manusia — tidak ada yang otomatis memeriksa
 * "semua pose kelihatan bagus". Yang bisa dijaga test: pratinjau benar-benar
 * memuat SETIAP kombinasi mood × pose × varian (jangan sampai menambah mood
 * baru lalu pratinjau diam-diam ketinggalan), tidak ada art rusak, dan aturan
 * gerak yang sama dengan komponen (kedip & reduced-motion) ikut tercermin.
 */
describe("pratinjau pose maskot", () => {
  const html = buildMascotPreviewHtml();

  it("memuat setiap kombinasi mood × pose × varian", () => {
    for (const mood of CAT_MOODS) {
      for (const pose of CAT_POSES) {
        for (const variant of CAT_VARIANTS) {
          // Bandingkan bagian art-nya saja: caption kartu memang berbeda-beda.
          const tile = mascotTile({ mood, pose, variant, size: 96, caption: "" });
          const art = tile.slice(0, tile.indexOf("<figcaption>"));
          expect(html, `${mood}/${pose}/${variant} tidak ada di pratinjau`).toContain(art);
        }
      }
    }
    const tiles = html.split('class="tile"').length - 1;
    expect(tiles).toBe(CAT_MOODS.length * CAT_POSES.length * CAT_VARIANTS.length + REAL_SIZE_PREVIEWS.length);
  });

  it("memuat strip ukuran nyata app beserta animasi masuk", () => {
    for (const entry of REAL_SIZE_PREVIEWS) {
      expect(html).toContain(`width:${entry.size}px;height:${entry.size}px`);
    }
    expect(html).toContain('class="mascot walking"');
    expect(html).toContain("@keyframes walkIn");
  });

  it("tidak ada angka atau nilai rusak di SVG maupun CSS", () => {
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
  });

  it("kedip hanya dipasang pada mood bermata terbuka", () => {
    expect(mascotTile({ mood: "idle", pose: "sit", size: 96, caption: "x" })).toContain('class="mascot blink"');
    expect(mascotTile({ mood: "encourage", pose: "sit", size: 96, caption: "x" })).toContain('class="mascot blink"');
    for (const mood of ["happy", "cheer", "sleepy", "wink"] as const) {
      expect(mascotTile({ mood, pose: "sit", size: 96, caption: "x" }), mood).toContain('class="mascot"');
      expect(mascotTile({ mood, pose: "sit", size: 96, caption: "x" }), mood).not.toContain("blink");
    }
  });

  it("punya jalur reduced-motion: tombol tiruan & setelan OS", () => {
    expect(html).toContain("prefers-reduced-motion");
    expect(html).toContain("body.no-motion .layer");
    expect(html).toContain("useReducedMotion()");
  });

  it("semua layer punya aturan animasi di stylesheet", () => {
    for (const id of ["tail", "body", "eyes", "wave"] as const) {
      expect(html).toContain(`.l-${id} {`);
    }
  });

  it("harness reduced-motion menyisipkan override SEBELUM script bundle", () => {
    const index = '<!doctype html><html><body><div id="root"></div><script src="/_expo/static/js/web/entry-abc.js" defer></script></body></html>';
    const page = withForcedReducedMotion(index);
    expect(page).toContain("prefers-reduced-motion");
    expect(page).toContain("matches:true");
    // Harness hidup di /_brand/...: router harus diarahkan ke / tanpa memuat
    // ulang dokumen, supaya override tidak hilang.
    expect(page).toContain("history.replaceState(null,'','/')");
    // Kalau override datang setelah script bundle, ia terlambat: Reanimated
    // membaca setelan OS saat modulnya pertama kali dimuat.
    expect(page.indexOf("prefers-reduced-motion")).toBeLessThan(page.indexOf("entry-abc.js"));
    expect(page).toContain('<div id="root"></div>');
    expect(page).toContain("entry-abc.js");
  });

  it("harness reduced-motion menolak index.html yang tidak punya #root", () => {
    expect(() => withForcedReducedMotion("<html><body></body></html>")).toThrow(/#root/);
  });
});
