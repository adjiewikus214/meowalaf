const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite (web) memuat wa-sqlite.wasm di dalam worker → Metro harus memperlakukan
// .wasm sebagai asset, bukan modul. Tanpa baris ini export web gagal "Unable to resolve".
if (!config.resolver.assetExts.includes("wasm")) {
  config.resolver.assetExts.push("wasm");
}

module.exports = withNativewind(config);
