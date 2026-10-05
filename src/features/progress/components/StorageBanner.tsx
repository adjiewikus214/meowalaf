/**
 * Owner: features/progress/components. Banner status penyimpanan progres.
 *
 * Kenapa TIDAK di ui/components lagi: file ini memakai `t()` dari core/i18n,
 * sedangkan ui/ tidak boleh meng-import core (ARCHITECTURE § 3, dicek lint).
 * Logikanya sama seperti QuestionCard yang pindah ke features/ karena butuh tipe
 * domain: komponen yang butuh domain/core ikut ke features, bukan ui.
 *
 * Tetap presentasi murni: pemanggil (app) yang membaca status dari core,
 * komponen ini hanya menerima fase + alasannya.
 *
 * Kenapa komponen ini ada (RULES § 4 + § 8): kalau progres tidak tersimpan,
 * user berhak tahu SEBELUM dia mengerjakan satu lesson yang nanti hilang —
 * bukan sesudah.
 */
import { Text, View } from "react-native";

import { useT } from "@/core/i18n/hooks";

export type StorageBannerPhase = "opening" | "waiting" | "sqlite" | "memory";

export type StorageBannerProps = {
  phase: StorageBannerPhase;
  /** Alasan singkat dari core; dipakai sebagai kalimat kedua. */
  reason?: string | null;
  /** True kalau penyebabnya tab lain (bukan storage rusak) → nada lebih lembut. */
  otherTab?: boolean;
};

export function StorageBanner({ phase, reason, otherTab = false }: StorageBannerProps) {
  const { t } = useT();
  if (phase !== "memory" && phase !== "waiting") return null;

  if (phase === "waiting") {
    return (
      <View
        accessibilityRole="alert"
        className="mx-4 mt-2 rounded-card border border-warn/40 bg-warn/10 px-4 py-3"
      >
        <Text className="text-warn font-sans-semibold text-xs">{t("storage.waiting")}</Text>
        <Text className="text-ink-secondary text-[11px] leading-4 mt-0.5">
          {t("storage.waitingBody")}
        </Text>
      </View>
    );
  }

  return (
    <View
      accessibilityRole="alert"
      className={`mx-4 mt-2 rounded-card border px-4 py-3 ${
        otherTab ? "border-warn/40 bg-warn/10" : "border-danger/40 bg-danger/10"
      }`}
    >
      <Text className={`font-sans-semibold text-xs ${otherTab ? "text-warn" : "text-danger"}`}>
        {t("storage.unsaved")}
      </Text>
      <Text className="text-ink-secondary text-[11px] leading-4 mt-0.5">
        {/* Alasan dari core berbahasa Indonesia (diagnostik internal), jadi
            jangan ditampilkan apa adanya kalau penyebabnya tab lain — ada
            kuncinya sendiri yang ikut bahasa pilihan user. */}
        {otherTab
          ? `${t("storage.reasonOtherTab")} ${t("storage.unsavedBody")}`
          : reason
            ? `${reason} ${t("storage.unsavedBody")}`
            : `${t("storage.unsavedFallback")} ${t("storage.unsavedBody")}`}
      </Text>
    </View>
  );
}
