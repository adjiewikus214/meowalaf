/**
 * Root layout (presentasi tipis — aturan ARCHITECTURE.md § 3).
 * Menahan splash sampai fonts + store persisten siap, lalu mengarahkan onboarding.
 */
import "../global.css";

import { useEffect } from "react";
import { Platform, StyleSheet } from "react-native";
import { Stack, Redirect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";

import { useStorageStatus } from "@/core/db/storage-status";
import { prefetchQuranText } from "@/core/content/text-module";
import { usePersistentHydration, useSplashReveal } from "@/core/progress/hydration";
import { useProfileStore } from "@/core/progress/store";
import { AchievementToastHost } from "@/features/gamification/components/AchievementToastHost";
import { PrayerSync } from "@/features/prayer/PrayerSync";
import { ReminderSync } from "@/features/reminders/ReminderSync";
import { StorageBanner } from "@/features/progress/components/StorageBanner";
import { AmiriRegular, NotoSansRegular, PoppinsBold, PoppinsRegular } from "@/ui/assets/fonts";

void SplashScreen.preventAutoHideAsync().catch(() => null);

// Kunci di sini HARUS sama dengan nama di global.css (--font-sans/--font-display/
// --font-arab/--font-translit). Tidak ada font-weight di app, jadi weight lain
// tidak pernah dirender. Noto Sans hanya ikut sebagai fallback transliterasi
// Arab — bukan body font (lihat src/ui/transliteration.ts).
const FONT_MAP = {
  "Poppins-Regular": PoppinsRegular,
  "Poppins-Bold": PoppinsBold,
  "NotoSans-Regular": NotoSansRegular,
  "Amiri-Regular": AmiriRegular,
} as const;

const IS_WEB = Platform.OS === "web";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_MAP);
  const onboarded = useProfileStore((s) => s.onboarded);
  const storage = useStorageStatus((s) => s.status);

  // Degradasi elegan: font gagal → lanjut dengan fallback sistem (jangan layar hitam).
  const fontsReady = fontsLoaded || fontError !== null;

  // ADR-009. Di web splash tidak lagi menunggu SQLite, dan opening DB justru
  // DIMULAI setelah shell tampil: unduhan wasm 0,29 MB yang jalan sejak mount
  // akan berebut pipa yang sama dengan entry / `__common` / font yang justru
  // dibutuhkan untuk paint, jadi "DB di luar jalur splash" hanya benar di
  // atas kertas. Di native tidak ada unduhan itu, jadi splash tetap
  // menunggu hydration seperti sebelumnya.
  const { reveal: shellReveal } = useSplashReveal(fontsReady, !IS_WEB);
  const hydrated = usePersistentHydration(IS_WEB ? shellReveal : true);
  const reveal = IS_WEB ? shellReveal : fontsReady && hydrated;

  useEffect(() => {
    if (reveal) {
      void SplashScreen.hideAsync().catch(() => null);
      // Teks Quran (~2,6 MB) sengaja TIDAK ada di bundle awal supaya Home tidak
      // menunggu teks ayat (docs/PERF.md). Supaya layar materi tidak menunggu
      // jaringan saat user menekan "Lanjut Ngaji", chuck-nya sekarang juga saat
      // browser idle — setelah Home tampil, bukan sebelumnya. Diikat ke `reveal`
      // (bukan ke `hydrated`): teks mushaf tidak bergantung ke SQLite, jadi tidak
      // perlu ikut menunggu DB, dan justru berguna selama DB masih dibuka.
      const idle = (
        globalThis as unknown as {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        }
      ).requestIdleCallback;
      if (typeof idle === "function") idle(() => void prefetchQuranText(), { timeout: 2000 });
      else setTimeout(() => void prefetchQuranText(), 600);
    }
  }, [reveal]);

  if (!reveal) {
    return null; // splash masih tampil
  }

  return (
    <SafeAreaProvider style={styles.root}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0B0F0E" } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="surah/[surahId]" />
        <Stack.Screen name="about" />
        <Stack.Screen name="bookmarks" />
        <Stack.Screen name="tasbih" />
        <Stack.Screen name="prayer" />
        <Stack.Screen name="lesson/[surahId]/[unitIndex]" />
      </Stack>
      {/* Toast achievement global — achievement bisa terbuka dari lesson hasil
          MAUPUN dari membuka surat, jadi-hoisting di root layout, bukan per-screen. */}
      <AchievementToastHost />
      {/* Status penyimpanan progres: kalau tab ini kebetulan jadi tab kedua,
          user harus tahu progresnya belum aman — bukan finding out belakangan. */}
      <StorageBanner
        phase={storage.phase}
        reason={storage.reason}
        otherTab={storage.otherTab}
      />
      {/* Jadwal pengingat harian disinkronkan di sini (bukan per-screen) supaya
          jadwal tetap benar dari layar mana pun; no-op bersih di web. */}
      <ReminderSync />
      {/* Pengingat lima waktu salat (ADR-010) juga disinkronkan di sini: jadwalnya
          bergeser tiap hari, jadi harus disegarkan tanpa membuka layar salat. */}
      <PrayerSync />
      {!onboarded ? <Redirect href="/onboarding" /> : null}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#0B0F0E" },
});
