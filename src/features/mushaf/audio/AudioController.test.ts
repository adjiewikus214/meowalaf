import { describe, expect, it, vi } from "vitest";

import { createAudioController } from "./AudioController";
import type { AudioEngine } from "./AudioController";

function fakeEngine(): AudioEngine & { emitEnded: () => void; failLoad: boolean } {
  let ended: () => void = () => null;
  return {
    failLoad: false,
    async load(url) {
      if (this.failLoad) throw new Error("offline");
      void url;
    },
    async play() {},
    async pause() {},
    async stop() {},
    onEnded(cb) {
      ended = cb;
    },
    dispose() {},
    emitEnded: () => ended(),
  };
}

const RN = { surahId: 1, ayahNumber: 1, totalAyahs: 7, reciterId: "juhany", autoplayNext: true };

describe("AudioController", () => {
  it("idle → loading → playing saat play sukses", async () => {
    const engine = fakeEngine();
    const c = createAudioController(engine);
    const p = c.play(RN.surahId, RN.ayahNumber, RN.totalAyahs, RN.reciterId, true);
    expect(c.getState().status).toBe("loading");
    await p;
    expect(c.getState().status).toBe("playing");
    expect(c.getState().nowPlaying?.ayahNumber).toBe(1);
  });

  it("load gagal → status unavailable (degradasi elegan, bukan crash)", async () => {
    const engine = fakeEngine();
    engine.failLoad = true;
    const c = createAudioController(engine);
    await c.play(RN.surahId, RN.ayahNumber, RN.totalAyahs, RN.reciterId, true);
    expect(c.getState().status).toBe("unavailable");
  });

  it("auto-advance ke ayat berikutnya saat ended, berhenti di akhir surah", async () => {
    const engine = fakeEngine();
    const c = createAudioController(engine);
    await c.play(1, 6, 7, RN.reciterId, true);
    engine.emitEnded();
    await Promise.resolve();
    await vi.waitFor(() => {
      expect(c.getState().nowPlaying?.ayahNumber).toBe(7);
    });
    // ayat terakhir selesai → idle, tidak loncat ke surah lain (PRD § 5.3 AC)
    await c.play(1, 7, 7, RN.reciterId, true);
    engine.emitEnded();
    await vi.waitFor(() => {
      expect(c.getState().status).toBe("idle");
      expect(c.getState().nowPlaying).toBeNull();
    });
  });

  it("permintaan cepat beruntun: token mencegah state basi (race)", async () => {
    const engine = fakeEngine();
    const c = createAudioController(engine);
    const p1 = c.play(1, 1, 7, RN.reciterId, false);
    const p2 = c.play(1, 2, 7, RN.reciterId, false);
    await Promise.all([p1, p2]);
    expect(c.getState().nowPlaying?.ayahNumber).toBe(2);
    expect(c.getState().status).toBe("playing");
  });

  it("ganti qari di tengah playing: mulai ulang ayat sama dengan qari baru", async () => {
    const engine = fakeEngine();
    const c = createAudioController(engine);
    await c.play(1, 3, 7, RN.reciterId, false);
    c.setReciter("husary");
    await vi.waitFor(() => {
      expect(c.getState().reciterId).toBe("husary");
      expect(c.getState().nowPlaying?.ayahNumber).toBe(3);
    });
  });

  it("stop mengembalikan idle", async () => {
    const engine = fakeEngine();
    const c = createAudioController(engine);
    await c.play(2, 1, 286, RN.reciterId, false);
    await c.stop();
    expect(c.getState().status).toBe("idle");
    expect(c.getState().nowPlaying).toBeNull();
  });
});
