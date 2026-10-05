/**
 * Owner: features/mushaf/audio. Engine audio native — expo-audio.
 * Tidak di-import langsung screen; dipilih via engine-index.ts (ARCHITECTURE.md § 7).
 */
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import type { AudioPlayer } from "expo-audio";

import type { AudioEngine } from "./AudioController";

let player: AudioPlayer | null = null;
let endedCb: (() => void) | null = null;
let modeReady = false;

async function ensureMode(): Promise<void> {
  if (modeReady) return;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
  } catch {
    // sebagian opsi tak didukung platform — lanjut saja
  }
  modeReady = true;
}

export function createNativeEngine(): AudioEngine {
  return {
    async load(url: string) {
      await ensureMode();
      player?.release();
      player = createAudioPlayer({ uri: url });
      player.addListener?.("playbackStatusUpdate", (status: { didJustFinish?: boolean }) => {
        if (status.didJustFinish) endedCb?.();
      });
    },
    async play() {
      player?.play();
    },
    async pause() {
      player?.pause();
    },
    async stop() {
      player?.pause();
      player?.seekTo(0);
    },
    onEnded(cb) {
      endedCb = cb;
    },
    dispose() {
      player?.release();
      player = null;
    },
  };
}
