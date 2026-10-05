/**
 * Owner: core/prayer. Arah kiblat & jarak ke Ka'bah — PURE (input angka, output
 * angka; tanpa Date, tanpa sensor).
 *
 * Keputusan produk yang penting, dan alasan file ini berbentuk angka bukan
 * panah: yang dihitung di sini adalah **bearing great-circle dari utara
 * sebenarnya**, bukan arah dari kompas device. Kompas butuh magnetometer +
 * kalibrasi dan tidak bisa diuji di web/CI sama sekali (lihat ADR-010), jadi
 * untuk rilis pertama yang ditampilkan adalah sudut + arah mata angin —
 * nilainya bisa dipertanggungjawabkan terhadap acuan publik, dan user tetap
 * bisa memakainya dengan kompas apa pun yang ia percaya.
 */

/** Ka'bah, Makkah (Kemenag/umum). Titik acuan untuk bearing & jarak. */
export const KAABA_LAT = 21.4225;
export const KAABA_LNG = 39.8262;

/** Jari-jari Bumi rata-rata (km) — cukup akurat untuk skala tampilan. */
const EARTH_RADIUS_KM = 6371.0088;

/** Delapan mata angin; UI yang menerjemahkan ke bahasanya (core tidak tahu bahasa). */
export type CompassPoint = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

const COMPASS_POINTS: readonly CompassPoint[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export type Coords = { lat: number; lng: number };

/**
 * Koordinat yang bisa dipakai berhitung, atau `null`. Dipakai untuk memvalidasi
 * apa pun yang datang dari luar (GPS device bisa mengirim NaN/rentang aneh).
 */
export function validCoords(value: Coords | null | undefined): Coords | null {
  if (value === null || value === undefined) return null;
  const { lat, lng } = value;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Normalisasi sudut ke 0 <= x < 360. */
function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * Bearing awal dari `(lat, lng)` ke Ka'bah, derajat dari utara sebenarnya
 * (0..360, searah jarum jam). Melempar untuk koordinat tidak valid: ini bug
 * pemanggil, bukan input user (input user sudah lewat `validCoords`).
 */
export function qiblaBearing(lat: number, lng: number): number {
  const coords = validCoords({ lat, lng });
  if (coords === null) throw new Error("qiblaBearing: koordinat tidak valid");

  const phi1 = toRadians(coords.lat);
  const phi2 = toRadians(KAABA_LAT);
  const deltaLng = toRadians(KAABA_LNG - coords.lng);

  const y = Math.sin(deltaLng) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLng);
  return normalizeDegrees((Math.atan2(y, x) * 180) / Math.PI);
}

/** Jarak great-circle antara dua titik, km (haversine). */
export function distanceKm(from: Coords, to: Coords): number {
  const a = validCoords(from);
  const b = validCoords(to);
  if (a === null || b === null) throw new Error("distanceKm: koordinat tidak valid");

  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Jarak dari satu titik ke Ka'bah, km. */
export function distanceToKaaba(lat: number, lng: number): number {
  return distanceKm({ lat, lng }, { lat: KAABA_LAT, lng: KAABA_LNG });
}

/**
 * Mata angin terdekat dari sebuah bearing (8 arah). Dipakai UI sebagai label di
 * samping angka derajat — 295° sendirian tidak membantu siapa pun.
 */
export function compassPoint(bearing: number): CompassPoint {
  const safe = Number.isFinite(bearing) ? normalizeDegrees(bearing) : 0;
  const index = Math.round(safe / 45) % COMPASS_POINTS.length;
  return COMPASS_POINTS[index] ?? "N";
}

/** Derajat dengan satu desimal ("295,1°") — pembulatan di satu tempat, bukan di UI. */
export function formatBearing(bearing: number): string {
  const safe = Number.isFinite(bearing) ? normalizeDegrees(bearing) : 0;
  return `${safe.toFixed(1)}\u00b0`;
}
