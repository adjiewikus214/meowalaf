/**
 * Owner: features/reminders. UI pengaturan pengingat harian di Profil.
 * Menulis ke profile store saja — penjadwalan_os ditangani ReminderSync, jadi
 * toggle di sini tidak perlu tahu apa-apa soal expo-notifications.
 *
 * Izin diminta saat user MENYALAKAN toggle (bukan saat app dibuka): OS lebih
 *percaya diri kalau izin diminta dari aksi yang jelas, dan kalau user menolak
 * toggle kita matikan lagi supaya UI tidak berbohong "aktif".
 */
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useT } from "@/core/i18n/hooks";
import { useProgressEventsStore } from "@/core/progress/lesson-store";
import { useProfileStore } from "@/core/progress/store";
import { Card } from "@/ui/components";

import {
  REMINDER_HOUR_CHOICES,
  canOfferReminder,
  formatReminderHour,
  reminderChoiceFor,
} from "./reminder";
import { isReminderSupported, requestReminderPermission } from "./reminder-scheduler";

type PermissionUi = "unknown" | "granted" | "denied";

export function ReminderSettings() {
  const { t } = useT();
  const reminderEnabled = useProfileStore((s) => s.reminderEnabled);
  const reminderHour = useProfileStore((s) => s.reminderHour);
  const setReminderEnabled = useProfileStore((s) => s.setReminderEnabled);
  const setReminderHour = useProfileStore((s) => s.setReminderHour);
  const sessions = useProgressEventsStore((s) => s.stats.sessions);
  const [permission, setPermission] = useState<PermissionUi>("unknown");
  const supported = isReminderSupported();
  const eligible = canOfferReminder(sessions);
  const choice = reminderChoiceFor(reminderHour);

  // Di native, cek izin saat layar dibuka supaya banner "izin belum diberikan"
  // akurat juga kalau user pernah menolak sebelumnya.
  useEffect(() => {
    if (!supported) return;
    let alive = true;
    void requestReminderPermission().then((result) => {
      if (alive) setPermission(result === "unsupported" ? "unknown" : result);
    });
    // Jangan setState kalau layar sudah ditutup sebelum promise selesai.
    return () => {
      alive = false;
    };
    // Sengaja hanya saat mount: jangan menanyakan izin berulang tiap render.
  }, [supported]);

  async function toggle() {
    if (reminderEnabled) {
      setReminderEnabled(false);
      return;
    }
    const result = await requestReminderPermission();
    setPermission(result === "unsupported" ? "unknown" : result);
    // Ditolak / tidak didukung → tetap MATI, jangan tampil aktif padahal nihil.
    setReminderEnabled(result === "granted");
  }

  if (!supported) {
    return (
      <Card className="gap-1">
        <Text className="text-ink-primary font-sans-semibold">{t("reminder.title")}</Text>
        <Text className="text-ink-secondary text-xs leading-5">{t("reminder.webOnly")}</Text>
      </Card>
    );
  }

  return (
    <Card className="gap-3">
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: reminderEnabled, disabled: !eligible }}
        accessibilityLabel={t("reminder.switchLabel")}
        disabled={!eligible}
        onPress={() => void toggle()}
        className="flex-row items-center justify-between gap-3 min-h-[44px]"
      >
        <View className="flex-1 gap-0.5">
          <Text
            className={`font-sans-semibold ${eligible ? "text-ink-primary" : "text-ink-secondary"}`}
          >
            {t("reminder.title")}
          </Text>
          <Text className="text-ink-secondary text-xs">
            {!eligible
              ? t("reminder.needsLesson")
              : reminderEnabled
                ? t("reminder.onAt", {
                    time: formatReminderHour(reminderHour),
                    after: choice === undefined ? "" : t("reminder.after", { label: choice.label }),
                  })
                : t("reminder.off")}
          </Text>
        </View>
        <View
          className={`w-12 h-7 rounded-full p-1 justify-center ${
            reminderEnabled && eligible ? "bg-brand-emerald" : "bg-white/10"
          }`}
        >
          <View
            className={`w-5 h-5 rounded-full bg-white ${reminderEnabled && eligible ? "self-end" : "self-start"}`}
          />
        </View>
      </Pressable>

      {permission === "denied" ? (
        <Text className="text-danger text-xs">{t("reminder.denied")}</Text>
      ) : null}

      {reminderEnabled && eligible ? (
        <View className="gap-2 border-t border-line pt-3">
          <Text className="text-ink-secondary text-[10px] uppercase tracking-widest font-sans-semibold">
            {t("reminder.when")}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {REMINDER_HOUR_CHOICES.map((option) => {
              const selected = option.hour === reminderHour;
              return (
                <Pressable
                  key={option.hour}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={t("reminder.chooseA11y", {
                    label: option.label,
                    time: formatReminderHour(option.hour),
                  })}
                  onPress={() => setReminderHour(option.hour)}
                  className={`rounded-xl px-3 py-2 border ${
                    selected ? "border-brand-emerald bg-brand-emerald/10" : "border-line bg-white/5"
                  }`}
                >
                  <Text className={`text-ink-primary text-xs ${selected ? "font-sans-semibold" : ""}`}>
                    {option.label} · {formatReminderHour(option.hour)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </Card>
  );
}