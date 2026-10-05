/**
 * Jadwal Salat & Kiblat (ADR-010). Layar ini presentasi tipis: semua aturan ada
 * di core/prayer (PURE) dan features/prayer (store + rencana pengingat).
 *
 * Dua kejujuran yang sengaja ditampilkan, bukan disembunyikan:
 *   - Kiblat tampil sebagai SUDUT dari utara sebenarnya, bukan panah kompas.
 *     Kompas device belum bisa di-QA, jadi tidak dijanjikan (lihat ADR-010).
 *   - Jadwal memakai metode Kemenag + ihtiyati 2 menit; asalnya ditulis di layar
 *     supaya user bisa menilai sendiri, bukan "angka dari langit".
 */
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { formatDay } from "@/core/i18n";
import type { TranslationKey } from "@/core/i18n";
import { useT } from "@/core/i18n/hooks";
import { searchCities, zoneLabel } from "@/core/prayer/cities";
import { compassPoint, distanceToKaaba, formatBearing, qiblaBearing } from "@/core/prayer/qibla";
import {
  IHTIYATI_MINUTES,
  computePrayerTimes,
  localClock,
  localDay,
  nextPrayer,
} from "@/core/prayer/times";
import { Card, SectionHeader } from "@/ui/components";
import { Ionicons } from "@/ui/icons";
import { TOUCH_TARGET } from "@/ui/tokens";
import { isReminderSupported, requestReminderPermission } from "@/features/reminders/reminder-scheduler";

import { isDeviceLocationSupported, requestDeviceLocation } from "@/features/prayer/device-location";
import { formatCountdown, formatLocationLabel, resolveLocation } from "@/features/prayer/prayer-plan";
import { usePrayerLocationStore } from "@/features/prayer/prayer-location-store";

type GpsUi = "idle" | "loading" | "saved" | "denied" | "failed";
type PermissionUi = "unknown" | "granted" | "denied";

export default function Prayer() {
  const { t, locale } = useT();
  const router = useRouter();

  const cityId = usePrayerLocationStore((s) => s.cityId);
  const source = usePrayerLocationStore((s) => s.source);
  const gps = usePrayerLocationStore((s) => s.gps);
  const notificationsEnabled = usePrayerLocationStore((s) => s.notificationsEnabled);

  const [now, setNow] = useState(() => new Date());
  const [gpsUi, setGpsUi] = useState<GpsUi>("idle");
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [permission, setPermission] = useState<PermissionUi>("unknown");

  const gpsSupported = isDeviceLocationSupported();
  const notifSupported = isReminderSupported();

  // Hitung mundur harus ikut berjalan tanpa reload; 30 detik cukup untuk satuan
  // menit dan jauh lebih hemat daripada 1 detik.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Izin hanya DIBACA saat layar dibuka (izin diminta saat user menyalakan
  // toggle) — supaya banner "ditolak" akurat tanpa mengganggu user.
  useEffect(() => {
    if (!notifSupported) return;
    let alive = true;
    void requestReminderPermission().then((result) => {
      if (alive) setPermission(result === "unsupported" ? "unknown" : result);
    });
    return () => {
      alive = false;
    };
  }, [notifSupported]);

  const location = useMemo(
    () => resolveLocation({ cityId, source, gps, notificationsEnabled }),
    [cityId, source, gps, notificationsEnabled],
  );
  const day = localDay(now, location.tzOffsetMinutes);
  const schedule = useMemo(
    () =>
      computePrayerTimes({
        lat: location.lat,
        lng: location.lng,
        tzOffsetMinutes: location.tzOffsetMinutes,
        date: day,
      }),
    [location.lat, location.lng, location.tzOffsetMinutes, day],
  );

  const nowMinutes = localClock(now, location.tzOffsetMinutes).minutes;
  const next = nextPrayer(schedule, nowMinutes);
  const nextTime = schedule.times.find((time) => time.id === next.id) ?? schedule.times[0];
  const bearing = qiblaBearing(location.lat, location.lng);
  const compass = compassPoint(bearing);
  const distance = distanceToKaaba(location.lat, location.lng);

  const cityResults = useMemo(() => searchCities(query), [query]);

  async function onUseGps() {
    setGpsUi("loading");
    const result = await requestDeviceLocation();
    if (result.status === "granted") {
      usePrayerLocationStore.getState().useGpsFix({
        lat: result.lat,
        lng: result.lng,
        accuracyM: result.accuracyM,
        at: Date.now(),
      });
      setGpsAccuracy(result.accuracyM);
      setGpsUi("saved");
      return;
    }
    setGpsUi(result.status === "denied" ? "denied" : "failed");
  }

  async function onToggleNotifications() {
    if (notificationsEnabled) {
      usePrayerLocationStore.getState().setNotificationsEnabled(false);
      return;
    }
    const result = await requestReminderPermission();
    setPermission(result === "unsupported" ? "unknown" : result);
    // Ditolak / tidak didukung → tetap mati: jangan tampil "nyala" padahal nihil.
    usePrayerLocationStore.getState().setNotificationsEnabled(result === "granted");
  }

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
          <Text className="text-ink-primary font-display text-xl">{t("prayer.title")}</Text>
          <Text className="text-ink-secondary text-xs">
            {formatDay(locale, day)} · {formatLocationLabel(location, locale)}
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 32, gap: 16 }}>
        {/* Waktu berikutnya: satu angka yang paling sering dicari user. */}
        <Card variant="glass" className="gap-2">
          <Text className="text-ink-secondary text-[10px] uppercase tracking-widest font-sans-semibold">
            {t("prayer.nextUp")}
          </Text>
          <View className="flex-row items-end justify-between">
            <View>
              <Text testID="prayer-next-name" className="text-ink-primary font-display text-2xl">
                {nextTime === undefined ? "—" : t(nextTime.labelKey)}
              </Text>
              <Text className="text-ink-secondary text-xs">
                {next.tomorrow ? t("prayer.tomorrow") : ""}
              </Text>
            </View>
            <Text testID="prayer-next-clock" className="text-ink-primary font-display text-3xl">
              {nextTime === undefined
                ? "--:--"
                : `${String(Math.floor(next.minutes / 60)).padStart(2, "0")}:${String(next.minutes % 60).padStart(2, "0")}`}
            </Text>
          </View>
          <Text testID="prayer-countdown" className="text-brand-emerald font-sans-semibold">
            {formatCountdown(next, locale)}
          </Text>
          <Text className="text-ink-secondary text-[10px] leading-4">
            {t("prayer.ihtiyatiNote", { minutes: IHTIYATI_MINUTES })}
          </Text>
        </Card>

        <View className="gap-2">
          <SectionHeader title={t("prayer.today")} />
          <Card className="gap-1">
            {schedule.times.map((time) => {
              const isNext = time.id === next.id;
              return (
                <View
                  key={time.id}
                  testID={`prayer-row-${time.id}`}
                  className={`flex-row items-center justify-between rounded-xl px-3 py-2 ${
                    isNext ? "bg-brand-emerald/10 border border-brand-emerald/40" : ""
                  }`}
                >
                  <Text
                    className={`text-sm ${isNext ? "text-brand-emerald font-sans-semibold" : "text-ink-primary"}`}
                  >
                    {t(time.labelKey)}
                  </Text>
                  <Text
                    className={`text-sm ${isNext ? "text-brand-emerald font-sans-semibold" : "text-ink-secondary"}`}
                  >
                    {`${String(Math.floor(time.minutes / 60)).padStart(2, "0")}:${String(time.minutes % 60).padStart(2, "0")}`}
                  </Text>
                </View>
              );
            })}
          </Card>
        </View>

        <View className="gap-2">
          <SectionHeader title={t("prayer.qiblaSection")} />
          <Card className="gap-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text testID="prayer-qibla-bearing" className="text-ink-primary font-display text-2xl">
                  {t("prayer.qiblaBearing", { degrees: formatBearing(bearing) })}
                </Text>
                <Text className="text-ink-secondary text-sm">
                  {t(`prayer.compass.${compass}` as TranslationKey)} ·{" "}
                  {t("prayer.qiblaDistance", { km: Math.round(distance) })}
                </Text>
              </View>
              {/* Panah diletakkan mengikuti SUDUT, bukan sensor: putar HP sampai
                  sisi panah menunjukkan angka di atas. */}
              <View className="w-14 h-14 rounded-full border border-line items-center justify-center">
                <Ionicons name="compass" size={26} color="#10B981" />
              </View>
            </View>
            <Text className="text-ink-secondary text-xs leading-5">{t("prayer.qiblaHint")}</Text>
          </Card>
        </View>

        <View className="gap-2">
          <SectionHeader title={t("prayer.locationSection")} />
          <Card className="gap-3">
            <View className="gap-0.5">
              <Text className="text-ink-primary font-sans-semibold">
                {formatLocationLabel(location, locale)}
              </Text>
              <Text className="text-ink-secondary text-xs">
                {t("prayer.tzNote", { zone: zoneLabel(location.tzOffsetMinutes) })}
              </Text>
            </View>

            {gpsSupported ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("prayer.gpsButton")}
                  testID="prayer-gps-button"
                  disabled={gpsUi === "loading"}
                  onPress={() => void onUseGps()}
                  className="rounded-xl px-4 py-3 border border-brand-emerald/50 bg-brand-emerald/10 items-center"
                >
                  <Text className="text-brand-emerald font-sans-semibold">
                    {gpsUi === "loading" ? "…" : t("prayer.gpsButton")}
                  </Text>
                </Pressable>
                <Text className="text-ink-secondary text-[10px]">{t("prayer.gpsHint")}</Text>
                {gpsUi === "saved" ? (
                  <Text className="text-brand-emerald text-xs">
                    {t("prayer.gpsSaved", { accuracy: gpsAccuracy ?? 0 })}
                  </Text>
                ) : null}
                {gpsUi === "denied" ? (
                  <Text className="text-danger text-xs">{t("prayer.gpsDenied")}</Text>
                ) : null}
                {gpsUi === "failed" ? (
                  <Text className="text-danger text-xs">{t("prayer.gpsFailed")}</Text>
                ) : null}
              </>
            ) : (
              <Text className="text-ink-secondary text-xs leading-5">{t("prayer.gpsWeb")}</Text>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={pickerOpen ? t("prayer.closeCityPicker") : t("prayer.chooseCity")}
              accessibilityState={{ expanded: pickerOpen }}
              testID="prayer-city-toggle"
              onPress={() => setPickerOpen((open) => !open)}
              className="rounded-xl px-4 py-3 border border-line bg-white/5 flex-row items-center justify-between"
            >
              <Text className="text-ink-primary">{t("prayer.chooseCity")}</Text>
              <Ionicons name={pickerOpen ? "chevron-up" : "chevron-down"} size={16} color="#9CA8A4" />
            </Pressable>

            {pickerOpen ? (
              <View className="gap-2">
                <TextInput
                  accessibilityLabel={t("prayer.searchCity")}
                  placeholder={t("prayer.searchCity")}
                  placeholderTextColor="#9CA8A4"
                  value={query}
                  onChangeText={setQuery}
                  testID="prayer-city-search"
                  autoCorrect={false}
                  className="rounded-xl px-4 py-3 border border-line bg-white/5 text-ink-primary"
                />
                {cityResults.length === 0 ? (
                  <Text className="text-ink-secondary text-xs">{t("prayer.cityEmpty")}</Text>
                ) : (
                  cityResults.map((city) => {
                    const active = city.id === location.cityId && source === "city";
                    return (
                      <Pressable
                        key={city.id}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${city.name}, ${city.province}`}
                        testID={`prayer-city-${city.id}`}
                        onPress={() => {
                          usePrayerLocationStore.getState().setCity(city.id);
                          setGpsUi("idle");
                          setPickerOpen(false);
                        }}
                        className={`rounded-xl px-4 py-3 border flex-row items-center justify-between ${
                          active ? "border-brand-emerald bg-brand-emerald/10" : "border-line bg-white/5"
                        }`}
                      >
                        <View>
                          <Text className="text-ink-primary text-sm font-sans-semibold">{city.name}</Text>
                          <Text className="text-ink-secondary text-[10px]">{city.province}</Text>
                        </View>
                        {active ? <Text className="text-brand-emerald">✓</Text> : null}
                      </Pressable>
                    );
                  })
                )}
              </View>
            ) : null}
          </Card>
        </View>

        <View className="gap-2">
          <SectionHeader title={t("prayer.notifSection")} />
          {notifSupported ? (
            <Card className="gap-3">
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: notificationsEnabled }}
                accessibilityLabel={t("prayer.notifToggle")}
                testID="prayer-notif-toggle"
                onPress={() => void onToggleNotifications()}
                className="flex-row items-center justify-between gap-3 min-h-[44px]"
              >
                <View className="flex-1 gap-0.5">
                  <Text className="text-ink-primary font-sans-semibold">{t("prayer.notifToggle")}</Text>
                  <Text className="text-ink-secondary text-xs">
                    {notificationsEnabled ? t("prayer.notifOn") : t("prayer.notifOff")}
                  </Text>
                </View>
                <View
                  className={`w-12 h-7 rounded-full p-1 justify-center ${
                    notificationsEnabled ? "bg-brand-emerald" : "bg-white/10"
                  }`}
                >
                  <View
                    className={`w-5 h-5 rounded-full bg-white ${notificationsEnabled ? "self-end" : "self-start"}`}
                  />
                </View>
              </Pressable>
              <Text className="text-ink-secondary text-xs leading-5">{t("prayer.notifHint")}</Text>
              {permission === "denied" ? (
                <Text className="text-danger text-xs">{t("prayer.notifDenied")}</Text>
              ) : null}
            </Card>
          ) : (
            <Card className="gap-1">
              <Text className="text-ink-primary font-sans-semibold">{t("prayer.notifToggle")}</Text>
              <Text className="text-ink-secondary text-xs leading-5">{t("prayer.notifWeb")}</Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
