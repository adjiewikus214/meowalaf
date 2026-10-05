/**
 * Owner: features/reminders. Menyelaraskan scheduler dengan store — SATU-SATUNYA
 * tempat yang memanggil schedule/batal. UI cukup menulis ke profile store; sinkron
 * yang terjadi sendiri. Dipasang di root layout (bukan per-screen) supaya jadwal
 * tetap benar saat app dibuka dari mana pun.
 *
 * Sifat penting: idempoten & aman gagal. Effect boleh dipanggil ulang berkali-kali
 * (ganti jam, buka app lagi,lesson baru masuk) karena `scheduleDailyReminder`
 * membatalkan jadwal lama lebih dulu — jadi tidak akan pernah ada duplikat.
 */
import { useEffect } from "react";

import { useProgressEventsStore } from "@/core/progress/lesson-store";
import { useProfileStore } from "@/core/progress/store";

import { canOfferReminder } from "./reminder";
import { clearDailyReminder, scheduleDailyReminder } from "./reminder-scheduler";

export function ReminderSync() {
  const enabled = useProfileStore((s) => s.reminderEnabled);
  const hour = useProfileStore((s) => s.reminderHour);
  const sessions = useProgressEventsStore((s) => s.stats.sessions);

  useEffect(() => {
    // Belum lesson pertama → jangan nag, dan pastikan tidak ada jadwal sisa.
    if (!enabled || !canOfferReminder(sessions)) {
      void clearDailyReminder();
      return;
    }
    void scheduleDailyReminder(hour);
  }, [enabled, hour, sessions]);

  return null;
}