/**
 * Owner: features/prayer. Adapter OS untuk lokasi device — satu-satunya berkas
 * yang menyentuh `expo-location`.
 *
 * Dua sifat yang disengaja, sama seperti adapter notifikasi:
 *   1. **WEB = tidak pernah diimpor.** GPS browser butuh prompt izin yang tidak
 *      ada gunanya di QA headless, dan di web user bisa memilih kota manual.
 *      Karena itu import-nya dinamis dan hanya jalan setelah cek platform.
 *   2. **Fail-soft total.** Lokasi itu pelengkap: kalau izin ditolak, device
 *      tidak melaporkan koordinat, atau modulnya melempar, hasilnya nilai balik
 *      — layar salat lanjut dengan kota manual, tidak pernah crash.
 *
 * Tidak ada reverse geocoding & tidak ada panggilan jaringan: koordinat dipakai
 * apa adanya, zona waktu dicari lokal dari daftar kota (lihat prayer-plan.ts).
 */
import { Platform } from "react-native";

import { validCoords } from "@/core/prayer/qibla";

export type DeviceLocationOutcome =
  | {
      status: "granted";
      lat: number;
      lng: number;
      /** Akurasi yang dilaporkan OS, meter (null kalau tidak dilaporkan). */
      accuracyM: number | null;
    }
  | { status: "denied" | "unsupported" | "failed"; reason?: string };

/** Lokasi device hanya mungkin di native; di web jalurnya adalah daftar kota. */
export function isDeviceLocationSupported(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

/** Import dinamis: di web modul expo-location tidak pernah dieksekusi. */
async function loadLocation() {
  return import("expo-location");
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Minta izin (kalau perlu) lalu ambil satu fix foreground. Akurasi `Balanced`:
 * cukup untuk waktu salat (beda 100 m tidak berarti) dan jauh lebih cepat/hemat
 * baterai daripada `Highest`, yang penting karena dipanggil dari aksi user.
 */
export async function requestDeviceLocation(): Promise<DeviceLocationOutcome> {
  if (!isDeviceLocationSupported()) return { status: "unsupported" };
  try {
    const expoLocation = await loadLocation();
    const current = await expoLocation.getForegroundPermissionsAsync();
    const permission =
      current.status === "undetermined"
        ? await expoLocation.requestForegroundPermissionsAsync()
        : current;
    if (!permission.granted) return { status: "denied" };

    const position = await expoLocation.getCurrentPositionAsync({
      accuracy: expoLocation.Accuracy.Balanced,
    });
    const coords = validCoords({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    });
    // Koordinat aneh (0,0 dari device yang belum mengunci) lebih baik ditolak
    // daripada dipakai menghitung jadwal di Teluk Guinea.
    if (coords === null) return { status: "failed", reason: "koordinat tidak valid" };

    const accuracy = position.coords.accuracy;
    return {
      status: "granted",
      lat: coords.lat,
      lng: coords.lng,
      accuracyM: typeof accuracy === "number" && Number.isFinite(accuracy) ? Math.round(accuracy) : null,
    };
  } catch (error) {
    console.warn("[prayer] gagal ambil lokasi:", describe(error));
    return { status: "failed", reason: describe(error) };
  }
}
