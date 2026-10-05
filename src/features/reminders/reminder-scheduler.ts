/**
 * Owner: features/reminders. Adapter OS untuk NOTIFIKASI LOKAL (bukan push —
 * tidak butuh server): pengingat ngaji harian + pengingat lima waktu salat.
 * Satu-satunya berkas di repo ini yang menyentuh expo-notifications — dua
 * pemakai tetap satu adapter supaya jaminan "web tidak pernah menyentuh API OS"
 * hanya perlu dibuktikan di satu tempat.
 *
 * Fail-soft total (RULES § 4): pengingat itu pelengkap, tidak boleh pernah
 * menjatuhkan app. Semua kesalahan jadi nilai balik, tidak pernah throw.
 *
 * WEB = no-op. `expo-notifications` tidak punya implementasi web untuk
 * schedule, jadi modul-nya tidak pernah diimpor di platform itu sama sekali
 * (dynamic import + cek Platform) — bundle web tetap bersih dan tidak pernah
 * menyentuh API yang tidak ada.
 *
 * Id jadwal disimpan di AsyncStorage, bukan hanya di memori: schedule yang dibuat
 * sesi lalu hilang begitu app restart, sehingga tanpa id tersimpan setiap start
 * akan menambah pengingat baru (duplikat yang menumpuk tiap launch).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { normalizeReminderHour, reminderContent } from "./reminder";

const STORAGE_KEY = "ayatin-reminder-schedule-v1";
const CHANNEL_ID = "ayatin-reminder";
const PRAYER_STORAGE_KEY = "ayatin-prayer-schedule-v1";
const PRAYER_CHANNEL_ID = "ayatin-prayer";

/** Batas aman jumlah notifikasi salat yang boleh dijadwalkan sekaligus. */
const MAX_PRAYER_REMINDERS = 7;

export type ReminderStatus =
  | "scheduled"
  | "cancelled"
  | "unsupported"
  | "denied"
  | "failed";

export type ReminderResult = {
  status: ReminderStatus;
  /** Jam terjadwal (hanya kalau scheduled). */
  hour?: number;
  reason?: string;
};

export type PermissionResult = "granted" | "denied" | "unsupported";

/** Pengingat hanya mungkin jalan di native. */
export function isReminderSupported(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

/** Import dinamis: di web modul ini tidak pernah dieksekusi. */
async function loadNotifications() {
  return (await import("expo-notifications"));
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Izin notifikasi. `unsupported` di web; `denied` bila user menolak. */
export async function requestReminderPermission(): Promise<PermissionResult> {
  if (!isReminderSupported()) return "unsupported";
  try {
    const Notifications = await loadNotifications();
    const current = await Notifications.getPermissionsAsync();
    // Minta ulang hanya kalau belum pernah decided — biar user tidak diganggu.
    const status = current.status === "undetermined" ? await Notifications.requestPermissionsAsync() : current;
    return status.granted ? "granted" : "denied";
  } catch (error) {
    console.warn("[reminder] gagal cek izin:", describe(error));
    return "denied";
  }
}

/** Batalkan jadwal yang tersimpan (idempoten). */
export async function clearDailyReminder(): Promise<ReminderResult> {
  if (!isReminderSupported()) return { status: "unsupported" };
  const id = await AsyncStorage.getItem(STORAGE_KEY);
  if (id === null) return { status: "cancelled" };
  try {
    const Notifications = await loadNotifications();
    await Notifications.cancelScheduledNotificationAsync(id);
    await AsyncStorage.removeItem(STORAGE_KEY);
    return { status: "cancelled" };
  } catch (error) {
    // Notifikasi yang sudah hilang (mis. reinstall) juga "berhasil" dibatalkan.
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => null);
    console.warn("[reminder] gagal batalkan jadwal:", describe(error));
    return { status: "cancelled" };
  }
}

/**
 * Jadwalkan pengingat harian pada jam lokal `hour`. Membatalkan jadwal lama
 * lebih dulu supaya tidak pernah ada duplikat.
 */
export async function scheduleDailyReminder(hour: number): Promise<ReminderResult> {
  if (!isReminderSupported()) return { status: "unsupported" };
  const target = normalizeReminderHour(hour);
  try {
    const Notifications = await loadNotifications();
    await clearDailyReminder();

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: "Pengingat ngaji",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#34D399",
      });
    }

    const { title, body } = reminderContent(target);
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: target, minute: 0 },
    });
    await AsyncStorage.setItem(STORAGE_KEY, id);
    return { status: "scheduled", hour: target };
  } catch (error) {
    console.warn("[reminder] gagal jadwalkan:", describe(error));
    return { status: "failed", reason: describe(error) };
  }
}

/* ------------------------------------------------------------------ *
 * Pengingat lima waktu salat (fitur salat, ADR-010)
 *
 * Berbeda dari pengingat ngaji (satu jam tetap), waktu salat BERGESER ~1 menit
 * per hari dan berbeda per lokasi. Karena itu jadwalnya dihitung fitur salat
 * (PURE) lalu dikirim ke sini sebagai angka jam:menit jadi, dan disegarkan tiap
 * app dibuka. `signature` mencegah penyegaran berulang membatalkan-membuat
 * notifikasi yang isinya sama (boros & berisiko kehilangan jadwal kalau app
 * ditutup di tengah proses).
 * ------------------------------------------------------------------ */

export type PrayerReminderRequest = {
  /** Id waktu salat ("subuh" dst) — bagian dari signature. */
  id: string;
  hour: number;
  minute: number;
  title: string;
  body: string;
};

export type PrayerScheduleResult = {
  status: "scheduled" | "cancelled" | "unsupported" | "failed";
  /** Jumlah notifikasi yang aktif (hanya kalau scheduled). */
  count?: number;
  /** true = jadwal OS sudah sama, tidak ada yang disentuh ulang. */
  unchanged?: boolean;
  reason?: string;
};

type StoredPrayerSchedule = { signature: string; ids: string[] };

async function readStoredPrayerSchedule(): Promise<StoredPrayerSchedule | null> {
  const raw = await AsyncStorage.getItem(PRAYER_STORAGE_KEY);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as StoredPrayerSchedule;
    if (typeof parsed.signature !== "string" || !Array.isArray(parsed.ids)) return null;
    return { signature: parsed.signature, ids: parsed.ids.filter((id) => typeof id === "string") };
  } catch {
    // Format lama/rusak tidak boleh menghentikan penjadwalan berikutnya.
    return null;
  }
}

/** Batalkan & lupakan jadwal salat yang tersimpan (idempoten). */
export async function clearPrayerReminders(): Promise<PrayerScheduleResult> {
  if (!isReminderSupported()) return { status: "unsupported" };
  const stored = await readStoredPrayerSchedule();
  if (stored === null) return { status: "cancelled" };

  try {
    const Notifications = await loadNotifications();
    for (const id of stored.ids) {
      // Satu notifikasi yang sudah hilang (reinstall, user hapus manual) bukan
      // alasan menggagalkan pembersihan sisanya.
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => null);
    }
  } catch (error) {
    console.warn("[prayer] gagal batalkan jadwal:", describe(error));
  }
  await AsyncStorage.removeItem(PRAYER_STORAGE_KEY).catch(() => null);
  return { status: "cancelled" };
}

/**
 * Selaraskan jadwal pengingat salat dengan `requests`. `signature` adalah sidik
 * jadwal (tanggal + jam tiap waktu) dari pemanggil; kalau sama dengan yang
 * tersimpan, tidak ada apa pun yang disentuh.
 */
export async function schedulePrayerReminders(
  requests: readonly PrayerReminderRequest[],
  signature: string,
): Promise<PrayerScheduleResult> {
  if (!isReminderSupported()) return { status: "unsupported" };

  const clean = requests
    .filter(
      (request) =>
        Number.isFinite(request.hour) &&
        Number.isFinite(request.minute) &&
        request.hour >= 0 &&
        request.hour <= 23 &&
        request.minute >= 0 &&
        request.minute <= 59,
    )
    .slice(0, MAX_PRAYER_REMINDERS)
    .map((request) => ({
      ...request,
      hour: Math.round(request.hour),
      minute: Math.round(request.minute),
    }));

  // Tidak ada jadwal valid = user mematikan pengingat; bersihkan, jangan simpan
  // entri kosong yang membuat status "nyala" padahal tidak ada notifikasi.
  if (clean.length === 0) return clearPrayerReminders();

  try {
    const stored = await readStoredPrayerSchedule();
    if (stored !== null && stored.signature === signature && stored.ids.length === clean.length) {
      return { status: "scheduled", count: clean.length, unchanged: true };
    }

    const Notifications = await loadNotifications();
    if (stored !== null) {
      for (const id of stored.ids) {
        await Notifications.cancelScheduledNotificationAsync(id).catch(() => null);
      }
      await AsyncStorage.removeItem(PRAYER_STORAGE_KEY).catch(() => null);
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(PRAYER_CHANNEL_ID, {
        name: "Pengingat salat",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#34D399",
      });
    }

    const ids: string[] = [];
    for (const request of clean) {
      ids.push(
        await Notifications.scheduleNotificationAsync({
          content: { title: request.title, body: request.body, sound: true },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: request.hour,
            minute: request.minute,
          },
        }),
      );
    }

    await AsyncStorage.setItem(PRAYER_STORAGE_KEY, JSON.stringify({ signature, ids }));
    return { status: "scheduled", count: clean.length };
  } catch (error) {
    console.warn("[prayer] gagal jadwalkan:", describe(error));
    return { status: "failed", reason: describe(error) };
  }
}