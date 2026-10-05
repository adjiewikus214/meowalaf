/**
 * Owner: features/mushaf/audio. Pemilih engine audio per platform.
 * Satu-satunya tempat yang tahu platform utk audio (ARCHITECTURE.md § 4.4).
 */
import { Platform } from "react-native";

import type { AudioEngine } from "./AudioController";

export function getEngine(): AudioEngine {
  if (Platform.OS === "web") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- bundler metadata .web
    const { createWebEngine } = require("./engine.web") as typeof import("./engine.web");
    return createWebEngine();
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- hindari import statis di web bundle
  const { createNativeEngine } = require("./engine.native") as typeof import("./engine.native");
  return createNativeEngine();
}
