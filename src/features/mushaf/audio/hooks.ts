/**
 * Owner: features/mushaf/audio. Hooks untuk screen — screen tak menyentuh engine langsung.
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";

import { useProfileStore } from "@/core/progress/store";

import { getAudioController } from "./AudioController";
import type { AudioState } from "./AudioController";

export function useAudio(): AudioState & {
  togglePlay: (surahId: number, ayahNumber: number, totalAyahs: number, autoplayNext: boolean) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
} {
  const controller = useMemo(() => getAudioController(), []);
  const state = useSyncExternalStore(controller.subscribe, controller.getState);

  useEffect(() => {
    controller.subscribe(() => null); // no-op keep-alive ref
  }, [controller]);

  const reciterId = useProfileStore((s) => s.reciterId);
  useEffect(() => {
    if (state.reciterId !== reciterId) {
      controller.setReciter(reciterId);
    }
  }, [controller, reciterId, state.reciterId]);

  return {
    ...state,
    togglePlay: (surahId, ayahNumber, totalAyahs, autoplayNext) => {
      const playingThis =
        state.nowPlaying !== null &&
        state.nowPlaying.surahId === surahId &&
        state.nowPlaying.ayahNumber === ayahNumber;
      if (playingThis && state.status === "playing") {
        void controller.pause();
        return;
      }
      if (playingThis && state.status === "paused") {
        void controller.resume();
        return;
      }
      void controller.play(surahId, ayahNumber, totalAyahs, reciterId, autoplayNext);
    },
    pause: () => void controller.pause(),
    resume: () => void controller.resume(),
    stop: () => void controller.stop(),
  };
}
