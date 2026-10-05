/**
 * "Tentang & Sumber Konten" (RULES § 7.6) — release blocker: atribusi WAJIB
 * ada sebelum rilis publik apa pun.
 *
 * Yang ditampilkan di sini bukan Dokumentasi developers, tapi klaim yang
 * dibaca user: dari mana teks & terjemahannya, siapa qarinya, dan hadis mana
 * yang dipakai beserta rawi + nomornya. Karena itu daftar hadis diambil dari
 * `HADITHS` (sumber yang sama dengan kartu Home) — bukan diketik ulang, supaya
 * tidak mungkin nomor melenceng dari teks yang tampil.
 *
 * Tanpa maskot: layar ini bersebelahan dengan atribusi teks suci (BRAND § 6.1 /
 * RULES § 7.9). Tidak ada emoji di vicinity mana pun (RULES § 7.5).
 */
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { formatDay } from "@/core/i18n";
import { useT } from "@/core/i18n/hooks";
import { contentManifest } from "@/core/content/meta";
import { HADITHS } from "@/features/home/hadith";
import { Card, SectionHeader } from "@/ui/components";
import { Ionicons } from "@/ui/icons";
import { TOUCH_TARGET } from "@/ui/tokens";

export default function About() {
  const { t, locale } = useT();
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <View className="px-4 pt-2 pb-3 flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={() => router.back()}
          style={{ width: TOUCH_TARGET, height: TOUCH_TARGET }}
          className="items-center justify-center rounded-full bg-white/5"
        >
          <Ionicons name="arrow-back" size={22} color="#F4F7F6" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-ink-primary font-display text-xl">{t("about.title")}</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8 gap-4">
        <Text className="text-ink-secondary text-sm px-1">{t("about.subtitle")}</Text>

        <View className="gap-2">
          <SectionHeader title={t("about.section.bundle")} />
          <Card className="gap-1">
            <Text className="text-ink-primary font-sans-semibold">
              {t("about.bundleSummary", {
                version: contentManifest.version,
                surahs: contentManifest.surahCount,
                ayahs: contentManifest.ayahCount,
              })}
            </Text>
            <Text className="text-ink-secondary text-xs">
              {t("about.bundleGenerated", {
                date: formatDay(locale, contentManifest.generatedAt.slice(0, 10)),
              })}
            </Text>
            <Text className="text-ink-secondary text-xs leading-5">
              {t("about.bundleChecksums")}
            </Text>
          </Card>
        </View>

        <View className="gap-2">
          <SectionHeader title={t("about.section.hadith")} />
          <Card className="gap-3">
            <Text className="text-ink-secondary text-xs leading-5">
              {t("about.hadithSummary")}
            </Text>
            {HADITHS.map((h, index) => (
              <View key={h.id} className="gap-0.5">
                <Text className="text-ink-secondary text-[10px] uppercase tracking-widest font-sans-semibold">
                  {t("about.hadithEntry", { index: index + 1 })}
                </Text>
                <Text className="text-ink-primary text-xs leading-5">
                  {t(h.attributionKey)}
                </Text>
              </View>
            ))}
          </Card>
        </View>

        {/* Metode waktu salat & kiblat (ADR-010) ditulis di sini karena ia
            "sumber" yang tidak berupa teks: user berhak tahu angkanya dari mana
            dan bahwa ia alat bantu — pola yang sama dengan atribusi konten. */}
        <View className="gap-2">
          <SectionHeader title={t("about.section.prayer")} />
          <Card className="gap-1">
            <Text className="text-ink-secondary text-xs leading-5">{t("about.prayerSummary")}</Text>
          </Card>
        </View>

        <View className="gap-2">
          <SectionHeader title={t("about.attributionSource")} />
          <Card className="gap-1">
            {contentManifest.attributions.map((a) => (
              <Text key={a} className="text-ink-secondary text-xs leading-5">
                • {a}
              </Text>
            ))}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
