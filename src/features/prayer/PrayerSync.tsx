/**
 * Owner: features/prayer. Menyelaraskan jadwal notifikasi salat dengan store —
 * dipasang di root layout (bukan di layar salat) supaya pengingatnya tetap benar
 * walaupun layarnya tidak pernah dibuka.
 *
 * Kenapa harus diselaraskan ulang: waktu salat bergeser ~1 menit per hari dan
 * berbeda per lokasi, jadi jadwal OS tidak bisa dipasang sekali untuk selamanya.
 * Adapter (`reminder-scheduler`) menyimpan signature jadwal, jadi penyelarasan
 * yang isinya sama tidak menyentuh OS sama sekali (anti-churn, ADR-010).
 *
 * Fail-soft: jadwal yang tidak bisa dihitung (data rusak) hanya dilewati; tidak
 * boleh ada crash di root layout hanya karena fitur pelengkap ini.
 *
 * Fitur ini memakai adapter di features/reminders supaya hanya SATU berkas di
 * repo yang menyentuh expo-notifications (batas yang sudah diuji di sana).
 */
import { useEffect } from "react";

import { useProfileStore } from "@/core/progress/store";
import { computePrayerTimes, localDay } from "@/core/prayer/times";
import { clearPrayerReminders, schedulePrayerReminders } from "@/features/reminders/reminder-scheduler";

import { prayerPlanSignature, prayerReminderPlan, resolveLocation } from "./prayer-plan";
import { usePrayerLocationStore } from "./prayer-location-store";

export function PrayerSync() {
  const cityId = usePrayerLocationStore((s) => s.cityId);
  const source = usePrayerLocationStore((s) => s.source);
  const gps = usePrayerLocationStore((s) => s.gps);
  const enabled = usePrayerLocationStore((s) => s.notificationsEnabled);
  const locale = useProfileStore((s) => s.locale);

  useEffect(() => {
    if (!enabled) {
      void clearPrayerReminders();
      return;
    }

    try {
      const location = resolveLocation({ cityId, source, gps, notificationsEnabled: enabled });
      const schedule = computePrayerTimes({
        lat: location.lat,
        lng: location.lng,
        tzOffsetMinutes: location.tzOffsetMinutes,
        date: localDay(new Date(), location.tzOffsetMinutes),
      });
      const plan = prayerReminderPlan(schedule, locale);
      void schedulePrayerReminders(plan, prayerPlanSignature(schedule, plan));
    } catch (error) {
      // Jadwal tidak sah = tidak ada pengingat yang dijadwalkan; dibatalkan
      // supaya jadwal basi tidak terus berbunyi di jam yang salah.
      console.warn("[prayer] jadwal pengingat dilewati:", error instanceof Error ? error.message : error);
      void clearPrayerReminders();
    }
  }, [cityId, source, gps, enabled, locale]);

  return null;
}
