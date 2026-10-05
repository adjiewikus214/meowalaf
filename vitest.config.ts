import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // react-native (Flow) tidak bisa diparse vitest → stub minimal untuk test pure
      "react-native": path.resolve(__dirname, "vitest-stubs/react-native.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
    environment: "node",
    setupFiles: [path.resolve(__dirname, "vitest-stubs/setup-content.ts")],
  },
});
