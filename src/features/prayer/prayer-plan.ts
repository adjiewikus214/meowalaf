/**
 * Owner: features/prayer. Aturan lokasi & pengingat salat — PURE (tanpa React,
 * tanpa OS, tanpa zustand). Store hanya menyimpan data mentah; keputusan
 * "koordinat mana yang dipakai" dan "notifikasi apa yang dijadwalkan" ada di
 * sini supaya bisa diuji tanpa device.
 *
 * Kenapa jalur GPS tetap punya kota acuan: zona waktu. Device bisa salah set
 * zona (user di Makassar dengan jam WIB), dan reverse-geocoding butuh jaringan
 * sementara app ini offline-first. Jadi offset zona diambil dari ibu kota
 * terdekat di daftar — hasilnya benar secara geografis tanpa panggilan apa pun
 * (lihat ADR-010).
 */
import { defaultCity, getCity, nearestCity, type PrayerCity } from "@/core/prayer/cities";
import { validCoords } from "@/core/prayer/qibla";
import {
  OBLIGATORY_PRAYER_IDS,
  prayerTime,
  type NextPrayer,
  type ObligatoryPrayerId,
  type PrayerSchedule,
} from "@/core/prayer/times";
import { translate, type Locale, type TranslationKey } from "@/core/i18n";

export type PrayerLocationSource = "city" | "gps";

export type GpsFix = {
  lat: number;
  lng: number;
  /** Akurasi dari OS, meter (bisa null kalau device tidak melaporkannya). */
  accuracyM: number | null;
  /** Epoch ms saat fix diambil — untuk membuang fix yang terlalu tua di masa depan. */
  at: number;
};

/** Data mentah yang dipersist. Sengaja kecil: tidak ada state turunan di sini. */
export type PrayerLocationState = {
  cityId: string;
  source: PrayerLocationSource;
  gps: GpsFix | null;
  /** Notifikasi lima waktu (native saja; web hanya menyimpan pilihannya). */
  notificationsEnabled: boolean;
};

export type ResolvedLocation = {
  lat: number;
  lng: number;
  tzOffsetMinutes: number;
  cityId: string;
  source: PrayerLocationSource;
  /** Jarak titik GPS ke kota acuan zona, km. `null` di jalur kota manual. */
  approxKm: number | null;
};

/**
 * Lokasi yang benar-benar dipakai untuk menghitung. Selalu berhasil: jalur GPS
 * dinyatakan aktif hanya kalau koordinatnya benar-benar valid, dan kalau tidak,
 * kota manual menggantikannya — layar salat tidak boleh kosong gara-gara GPS.
 */
export function resolveLocation(state: PrayerLocationState): ResolvedLocation {
  const fallback = getCity(state.cityId) ?? defaultCity();
  const fix = state.source === "gps" ? state.gps : null;
  const gps = fix === null ? null : validCoords({ lat: fix.lat, lng: fix.lng });

  if (gps === null) {
    return {
      lat: fallback.lat,
      lng: fallback.lng,
      tzOffsetMinutes: fallback.tzOffsetMinutes,
      cityId: fallback.id,
      source: "city",
      approxKm: null,
    };
  }

  const match = nearestCity(gps);
  const anchor: PrayerCity = match?.city ?? fallback;
  return {
    lat: gps.lat,
    lng: gps.lng,
    tzOffsetMinutes: anchor.tzOffsetMinutes,
    cityId: anchor.id,
    source: "gps",
    approxKm: match?.distanceKm ?? null,
  };
}

export type PrayerReminderRequest = {
  /** Id waktu salat ("subuh" dst) — dipakai untuk signature & idempotensi. */
  id: ObligatoryPrayerId;
  hour: number;
  minute: number;
  title: string;
  body: string;
};

const NOTIF_TITLE_KEYS: Record<ObligatoryPrayerId, TranslationKey> = {
  subuh: "prayer.notif.subuh",
  dzuhur: "prayer.notif.dzuhur",
  ashar: "prayer.notif.ashar",
  maghrib: "prayer.notif.maghrib",
  isya: "prayer.notif.isya",
};

/**
 * Lima permintaan notifikasi dari jadwal hari ini. Jam/menit dihitung di sini
 * (bukan di adapter OS) supaya bisa diuji: adapter hanya menerima angka jadi.
 * Isi pesannya ikut bahasa user — makanya `locale` jadi parameter, bukan
 * dibaca dari store.
 */
export function prayerReminderPlan(
  schedule: PrayerSchedule,
  locale: Locale,
): readonly PrayerReminderRequest[] {
  const plan: PrayerReminderRequest[] = [];
  for (const id of OBLIGATORY_PRAYER_IDS) {
    const time = prayerTime(schedule, id);
    if (time === undefined) continue;
    const wrapped = ((time.minutes % 1440) + 1440) % 1440;
    plan.push({
      id,
      hour: Math.floor(wrapped / 60),
      minute: wrapped % 60,
      title: translate(locale, NOTIF_TITLE_KEYS[id]),
      body: translate(locale, "prayer.notif.body"),
    });
  }
  return plan;
}

/** Signature jadwal: dipakai adapter supaya penyelarasan berulang tidak bikin duplikat. */
export function prayerPlanSignature(schedule: PrayerSchedule, plan: readonly PrayerReminderRequest[]): string {
  const times = plan.map((entry) => `${entry.id}@${entry.hour}:${entry.minute}`).join(",");
  return `${schedule.date}|${times}`;
}

/** Sisa waktu sampai salat berikutnya, sebagai kalimat siap tampil. */
export function formatCountdown(next: NextPrayer, locale: Locale): string {
  const wait = Math.max(0, Math.round(next.waitMinutes));
  if (wait <= 0) return translate(locale, "prayer.now");
  if (wait < 60) return translate(locale, "prayer.inMinutes", { count: wait });
  const hours = Math.floor(wait / 60);
  const minutes = wait % 60;
  if (minutes === 0) return translate(locale, "prayer.inHours", { hours });
  return translate(locale, "prayer.inHoursMinutes", { hours, minutes });
}

/**
 * Label lokasi untuk UI. Nama kota = nama diri (tidak diterjemahkan); hanya
 * awalan "sekitar" yang ikut bahasa, dan hanya muncul di jalur GPS.
 */
export function formatLocationLabel(location: ResolvedLocation, locale: Locale): string {
  const city = getCity(location.cityId);
  const name = city?.name ?? location.cityId;
  if (location.source !== "gps") return name;
  return translate(locale, "prayer.around", { city: name });
}
