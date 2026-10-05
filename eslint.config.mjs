// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import importX from "eslint-plugin-import-x";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    // .vercel/ = output build lokal dari Vercel CLI, android/ & ios/ = hasil
    // `expo prebuild` (CNG). Semuanya bukan kode yang kita tulis; tanpa ignore ini
    // ESLint menyisir ribuan file .js hasil minifier & template Gradle/RN.
    ignores: [
      ".expo/**",
      "node_modules/**",
      "dist/**",
      ".git/**",
      ".vercel/**",
      "android/**",
      "ios/**",
      "*.config.js",
      "vitest-stubs/**",
      "types/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "import-x": importX },
    settings: {
      "import-x/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
      },
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "import-x/no-unresolved": [
        "error",
        {
          ignore: ["\\.ttf$"], // asset Metro yang tipe-nya di types/assets.d.ts
        },
      ],
      // Boundary arsitektur (ARCHITECTURE.md § 3):
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/ui",
              from: "./src/features",
              message: "ui tidak boleh meng-import features (boundary, ARCHITECTURE.md § 3).",
            },
            {
              target: "./src/ui",
              from: "./src/core",
              message: "ui tidak boleh meng-import core (boundary, ARCHITECTURE.md § 3).",
            },
            {
              target: "./src/features",
              from: "./app",
              message: "features tidak boleh meng-import app (rute hanya presentasi).",
            },
            {
              target: "./src/core",
              from: "./src/features",
              message: "core tidak boleh meng-import features (arah: features -> core).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["app/**/*.tsx", "src/**/*.tsx"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...(Array.isArray(reactHooks.configs.recommended)
        ? reactHooks.configs.recommended[0]?.rules
        : reactHooks.configs.recommended.rules),
    },
  },
  {
    // Skrip Node (mis. scripts/perf-budget.mjs) berjalan di Node, bukan di browser:
    // tanpa ini ESLint menganggap process/console/Buffer "not defined".
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
  prettier,
);
