/**
 * Owner: features/mushaf/audio. Engine audio utk web — HTMLAudioElement.
 * Tidak di-import langsung screen; dipilih via engine-index.ts (ARCHITECTURE.md § 7).
 */
import type { AudioEngine } from "./AudioController";

let element: HTMLAudioElement | null = null;
let endedCb: (() => void) | null = null;

function ensureElement(): HTMLAudioElement {
  if (element === null) {
    element = new Audio();
    element.addEventListener("ended", () => endedCb?.());
    element.addEventListener("error", () => endedCb?.()); // gagal → anggap selesai, status dijaga controller
  }
  return element;
}

export function createWebEngine(): AudioEngine {
  return {
    async load(url: string) {
      const el = ensureElement();
      el.pause();
      el.src = url;
      el.load();
      await new Promise<void>((resolve, reject) => {
        const ok = () => {
          cleanup();
          resolve();
        };
        const fail = () => {
          cleanup();
          reject(new Error(`audio load error: ${url}`));
        };
        const cleanup = () => {
          el.removeEventListener("canplay", ok);
          el.removeEventListener("error", fail);
        };
        el.addEventListener("canplay", ok);
        el.addEventListener("error", fail);
      });
    },
    async play() {
      await ensureElement().play();
    },
    async pause() {
      ensureElement().pause();
    },
    async stop() {
      const el = ensureElement();
      el.pause();
      el.currentTime = 0;
    },
    onEnded(cb) {
      endedCb = cb;
    },
    dispose() {
      if (element !== null) {
        element.pause();
        element.src = "";
      }
    },
  };
}
