import { ayahAudioUrl } from "@/core/content/meta";
import { getEngine } from "./engine-index";

/**
 * Owner: features/mushaf/audio. AudioController singleton (ARCHITECTURE.md § 4.4).
 * State machine: idle → loading → playing → paused/unavailable; auto-advance ke ayat berikutnya.
 * Engine platform-specific dipilih via Platform.select (engine-index.ts).
 */
export type AudioStatus = "idle" | "loading" | "playing" | "paused" | "unavailable";

export type NowPlaying = {
  surahId: number;
  ayahNumber: number;
  totalAyahs: number;
  autoplayNext: boolean;
};

type AudioEngine = {
  load(url: string): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  /** Resolve ketika playback selesai (atau dibatalkan/diganti). */
  onEnded(cb: () => void): void;
  dispose(): void;
};

type Listener = (state: AudioState) => void;

export type AudioState = {
  status: AudioStatus;
  nowPlaying: NowPlaying | null;
  reciterId: string;
};

export function createAudioController(engine: AudioEngine) {
  let state: AudioState = { status: "idle", nowPlaying: null, reciterId: "" };
  const listeners = new Set<Listener>();
  let token = 0;

  function setState(patch: Partial<AudioState>): void {
    state = { ...state, ...patch };
    listeners.forEach((l) => l(state));
  }

  engine.onEnded(() => {
    const np = state.nowPlaying;
    if (np === null || state.status !== "playing") return;
    if (np.autoplayNext && np.ayahNumber < np.totalAyahs) {
      void play(np.surahId, np.ayahNumber + 1, np.totalAyahs, state.reciterId, true);
    } else {
      setState({ status: "idle", nowPlaying: null });
    }
  });

  async function stopCurrent(): Promise<void> {
    token += 1;
    await engine.stop().catch(() => null);
  }

  async function play(
    surahId: number,
    ayahNumber: number,
    totalAyahs: number,
    reciterId: string,
    autoplayNext: boolean,
  ): Promise<void> {
    const url = ayahAudioUrl(reciterId, surahId, ayahNumber);
    const myToken = ++token;
    setState({ status: "loading", nowPlaying: { surahId, ayahNumber, totalAyahs, autoplayNext }, reciterId });
    try {
      await engine.load(url);
      if (myToken !== token) return; // sudah diganti permintaan lain
      await engine.play();
      if (myToken !== token) return;
      setState({ status: "playing" });
    } catch {
      // gagal muat/putar → degradasi elegan (PRD § 5.4 AC), bukan crash
      setState({ status: "unavailable" });
    }
  }

  async function pause(): Promise<void> {
    await engine.pause().catch(() => null);
    setState({ status: "paused" });
  }

  async function resume(): Promise<void> {
    await engine.play().catch(() => null);
    setState({ status: "playing" });
  }

  async function stop(): Promise<void> {
    await stopCurrent();
    setState({ status: "idle", nowPlaying: null });
  }

  function setReciter(reciterId: string): void {
    const np = state.nowPlaying;
    if (np !== null && (state.status === "playing" || state.status === "paused" || state.status === "loading")) {
      void play(np.surahId, np.ayahNumber, np.totalAyahs, reciterId, np.autoplayNext);
    } else {
      setState({ reciterId });
    }
  }

  function getState(): AudioState {
    return state;
  }

  function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    listener(state);
    return () => listeners.delete(listener);
  }

  function dispose(): void {
    listeners.clear();
    engine.dispose();
  }

  return { play, pause, resume, stop, setReciter, getState, subscribe, dispose };
}

export type AudioController = ReturnType<typeof createAudioController>;
export type { AudioEngine };

let singleton: AudioController | null = null;

export function getAudioController(): AudioController {
  if (singleton === null) {
    singleton = createAudioController(getEngine());
  }
  return singleton;
}
