/**
 * Owner: core/prayer. Daftar lokasi untuk jadwal salat & kiblat — PURE, data saja.
 *
 * Isinya 38 ibu kota provinsi Indonesia. Kenapa ibu kota provinsi, bukan semua
 * kabupaten/kota: jarak antar ibu kota provinsi paling jauh beberapa ratus km, dan
 * pada skala itu **selisih waktu salat hanya beberapa menit** — sebanding dengan
 * ihtiyati 2 menit yang sudah ditambahkan di times.ts. Daftar 500+ kabupaten akan
 * menambah berat tanpa menambah ketelitian. GPS device tetap jalur utama untuk
 * presisi; daftar ini jalur fallback yang selalu tersedia (web, izin ditolak).
 *
 * Zona waktu ikut data, bukan device: device Indonesia sering diset WIB walaupun
 * fisiknya di Makassar/Jayapura (lihat ADR-010). Untuk titik GPS, offset diambil
 * dari kota terdekat di daftar ini — tetap benar offline, tanpa panggilan jaringan.
 */
import { distanceKm, validCoords, type Coords } from "./qibla";

export type PrayerCity = {
  /** Slug stabil — dipakai sebagai nilai di store, bukan nama (nama bisa berubah). */
  id: string;
  name: string;
  province: string;
  lat: number;
  lng: number;
  /** Offset zona lokasi dari UTC, menit (WIB 420, WITA 480, WIT 540). */
  tzOffsetMinutes: number;
};

/** Jakarta: kota terpadat & paling netral untuk tampilan awal sebelum user memilih. */
export const DEFAULT_CITY_ID = "jakarta";

/** Diurutkan menurut nama supaya daftar pilihan tidak terlihat acak. */
export const PRAYER_CITIES: readonly PrayerCity[] = [
  { id: "ambon", name: "Ambon", province: "Maluku", lat: -3.6954, lng: 128.1814, tzOffsetMinutes: 540 },
  { id: "banda-aceh", name: "Banda Aceh", province: "Aceh", lat: 5.5483, lng: 95.3238, tzOffsetMinutes: 420 },
  { id: "bandar-lampung", name: "Bandar Lampung", province: "Lampung", lat: -5.3971, lng: 105.2668, tzOffsetMinutes: 420 },
  { id: "bandung", name: "Bandung", province: "Jawa Barat", lat: -6.9175, lng: 107.6191, tzOffsetMinutes: 420 },
  { id: "banjarmasin", name: "Banjarmasin", province: "Kalimantan Selatan", lat: -3.3186, lng: 114.5944, tzOffsetMinutes: 420 },
  { id: "bengkulu", name: "Bengkulu", province: "Bengkulu", lat: -3.8004, lng: 102.2655, tzOffsetMinutes: 420 },
  { id: "denpasar", name: "Denpasar", province: "Bali", lat: -8.6705, lng: 115.2126, tzOffsetMinutes: 480 },
  { id: "gorontalo", name: "Gorontalo", province: "Gorontalo", lat: 0.5435, lng: 123.0568, tzOffsetMinutes: 480 },
  { id: "jakarta", name: "Jakarta", province: "DKI Jakarta", lat: -6.1754, lng: 106.8272, tzOffsetMinutes: 420 },
  { id: "jambi", name: "Jambi", province: "Jambi", lat: -1.6101, lng: 103.6131, tzOffsetMinutes: 420 },
  { id: "jayapura", name: "Jayapura", province: "Papua", lat: -2.5916, lng: 140.6691, tzOffsetMinutes: 540 },
  { id: "kendari", name: "Kendari", province: "Sulawesi Tenggara", lat: -3.9778, lng: 122.515, tzOffsetMinutes: 480 },
  { id: "kupang", name: "Kupang", province: "Nusa Tenggara Timur", lat: -10.1772, lng: 123.607, tzOffsetMinutes: 480 },
  { id: "makassar", name: "Makassar", province: "Sulawesi Selatan", lat: -5.1477, lng: 119.4327, tzOffsetMinutes: 480 },
  { id: "mamuju", name: "Mamuju", province: "Sulawesi Barat", lat: -2.6748, lng: 118.8885, tzOffsetMinutes: 480 },
  { id: "manado", name: "Manado", province: "Sulawesi Utara", lat: 1.4748, lng: 124.8421, tzOffsetMinutes: 480 },
  { id: "manokwari", name: "Manokwari", province: "Papua Barat", lat: -0.8615, lng: 134.062, tzOffsetMinutes: 540 },
  { id: "mataram", name: "Mataram", province: "Nusa Tenggara Barat", lat: -8.5833, lng: 116.1167, tzOffsetMinutes: 480 },
  { id: "medan", name: "Medan", province: "Sumatera Utara", lat: 3.5952, lng: 98.6722, tzOffsetMinutes: 420 },
  { id: "merauke", name: "Merauke", province: "Papua Selatan", lat: -8.4932, lng: 140.4018, tzOffsetMinutes: 540 },
  { id: "nabire", name: "Nabire", province: "Papua Tengah", lat: -3.3515, lng: 135.4965, tzOffsetMinutes: 540 },
  { id: "padang", name: "Padang", province: "Sumatera Barat", lat: -0.9471, lng: 100.4172, tzOffsetMinutes: 420 },
  { id: "palangka-raya", name: "Palangka Raya", province: "Kalimantan Tengah", lat: -2.208, lng: 113.9164, tzOffsetMinutes: 420 },
  { id: "palembang", name: "Palembang", province: "Sumatera Selatan", lat: -2.9761, lng: 104.7754, tzOffsetMinutes: 420 },
  { id: "palu", name: "Palu", province: "Sulawesi Tengah", lat: -0.8917, lng: 119.8707, tzOffsetMinutes: 480 },
  { id: "pangkal-pinang", name: "Pangkal Pinang", province: "Kepulauan Bangka Belitung", lat: -2.1316, lng: 106.1169, tzOffsetMinutes: 420 },
  { id: "pekanbaru", name: "Pekanbaru", province: "Riau", lat: 0.5071, lng: 101.4478, tzOffsetMinutes: 420 },
  { id: "pontianak", name: "Pontianak", province: "Kalimantan Barat", lat: -0.0263, lng: 109.3425, tzOffsetMinutes: 420 },
  { id: "samarinda", name: "Samarinda", province: "Kalimantan Timur", lat: -0.5022, lng: 117.1536, tzOffsetMinutes: 480 },
  { id: "semarang", name: "Semarang", province: "Jawa Tengah", lat: -6.9667, lng: 110.4167, tzOffsetMinutes: 420 },
  { id: "serang", name: "Serang", province: "Banten", lat: -6.1104, lng: 106.1503, tzOffsetMinutes: 420 },
  { id: "sofifi", name: "Sofifi", province: "Maluku Utara", lat: 0.7375, lng: 127.5669, tzOffsetMinutes: 540 },
  { id: "sorong", name: "Sorong", province: "Papua Barat Daya", lat: -0.8762, lng: 131.2558, tzOffsetMinutes: 540 },
  { id: "surabaya", name: "Surabaya", province: "Jawa Timur", lat: -7.2575, lng: 112.7521, tzOffsetMinutes: 420 },
  { id: "tanjung-pinang", name: "Tanjung Pinang", province: "Kepulauan Riau", lat: 0.9179, lng: 104.4665, tzOffsetMinutes: 420 },
  { id: "tanjung-selor", name: "Tanjung Selor", province: "Kalimantan Utara", lat: 2.8375, lng: 117.3667, tzOffsetMinutes: 480 },
  { id: "wamena", name: "Wamena", province: "Papua Pegunungan", lat: -4.0996, lng: 138.9447, tzOffsetMinutes: 540 },
  { id: "yogyakarta", name: "Yogyakarta", province: "DI Yogyakarta", lat: -7.7956, lng: 110.3695, tzOffsetMinutes: 420 },
];

/** Kota dari id; id tak dikenal → undefined (pemanggil yang memilih fallback). */
export function getCity(id: string): PrayerCity | undefined {
  return PRAYER_CITIES.find((city) => city.id === id);
}

/** Kota default; selalu ada — kalau tidak, itu bug data, bukan kondisi user. */
export function defaultCity(): PrayerCity {
  const city = getCity(DEFAULT_CITY_ID);
  if (city === undefined) throw new Error("defaultCity: DEFAULT_CITY_ID tidak ada di daftar");
  return city;
}

export type CityMatch = {
  city: PrayerCity;
  /** Jarak ke kota tersebut, km. */
  distanceKm: number;
};

/**
 * Kota terdekat dari sebuah titik (great-circle), atau `null` kalau koordinatnya
 * tidak valid. Dipakai untuk dua hal: memberi label "sekitar <kota>" pada titik
 * GPS, dan mengambil zona waktunya.
 */
export function nearestCity(coords: Coords | null | undefined): CityMatch | null {
  const valid = validCoords(coords);
  if (valid === null) return null;

  let best: CityMatch | null = null;
  for (const city of PRAYER_CITIES) {
    const distance = distanceKm(valid, { lat: city.lat, lng: city.lng });
    if (best === null || distance < best.distanceKm) {
      best = { city, distanceKm: distance };
    }
  }
  return best;
}

/**
 * Label zona waktu untuk ditampilkan: "WIB", "WITA", "WIT", atau "UTC±HH:MM"
 * untuk offset lain. Singkatan zona Indonesia sengaja tidak diterjemahkan —
 * "WIB" adalah nama diri, bukan kata benda umum.
 */
export function zoneLabel(tzOffsetMinutes: number): string {
  if (tzOffsetMinutes === 420) return "WIB";
  if (tzOffsetMinutes === 480) return "WITA";
  if (tzOffsetMinutes === 540) return "WIT";
  const safe = Number.isFinite(tzOffsetMinutes) ? Math.round(tzOffsetMinutes) : 0;
  const sign = safe < 0 ? "-" : "+";
  const absolute = Math.abs(safe);
  const hh = String(Math.floor(absolute / 60)).padStart(2, "0");
  const mm = String(absolute % 60).padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

/**
 * Cari kota menurut nama atau provinsi (case-insensitive, tanpa aksen). Query
 * kosong = semua kota — daftar penuh memang yang ingin dilihat user saat memilih.
 */
export function searchCities(query: string): readonly PrayerCity[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return PRAYER_CITIES;
  return PRAYER_CITIES.filter(
    (city) => city.name.toLowerCase().includes(needle) || city.province.toLowerCase().includes(needle),
  );
}
