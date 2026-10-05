/**
 * Owner: core/prayer. Waktu salat untuk satu titik & satu tanggal — PURE
 * (input angka, output angka; tanpa Date runtime, tanpa zona waktu device).
 *
 * Kenapa PURE dan bukan langsung `new Date()`: app ini bisa dipakai dari zona
 * WIB/WITA/WIT sekaligus (dan device bisa salah set zona). Waktu salat dihitung
 * untuk **zona lokasi yang dipilih** (`tzOffsetMinutes`), bukan zona device —
 * tanpa itu, user di Makassar yang jamnya diset WIB akan melihat jadwal yang
 * salah satu jam. Zona device TIDAK bocor ke hasil: jangkar tanggal pun dibentuk
 * dari komponen lokal target (lihat komentar di computePrayerTimes).
 *
 * Metode: sudut Kemenag (Subuh 20°, Isya 18°, Ashar bayangan 1×) lewat library
 * adhan (MIT). Validasi angkanya ada di `times.test.ts` terhadap tabel referensi
 * Aladhan method 20 (Kementerian Agama RI) — selisih ≤ 2 menit, dan ihtiyati
 * 2 menit ditambahkan supaya waktu yang ditampilkan tidak pernah lebih awal
 * dari perhitungan (arah kesalahan yang aman untuk ibadah).
 */
import { CalculationMethod, Coordinates, PrayerTimes } from "adhan";

import type { TranslationKey } from "@/core/i18n";

export type PrayerId = "subuh" | "syuruq" | "dzuhur" | "ashar" | "maghrib" | "isya";

/** Syuruq bukan salat — hanya penanda. Tipe ini memisahkannya di level tipe. */
export type ObligatoryPrayerId = Exclude<PrayerId, "syuruq">;

/** Lima waktu salat (syuruq bukan salat — hanya penanda). */
export const PRAYER_IDS: readonly PrayerId[] = ["subuh", "syuruq", "dzuhur", "ashar", "maghrib", "isya"];
export const OBLIGATORY_PRAYER_IDS: readonly ObligatoryPrayerId[] = [
  "subuh",
  "dzuhur",
  "ashar",
  "maghrib",
  "isya",
];

/**
 * Ihtiyati: 2 menit ditambahkan pada lima waktu salat (bukan syuruq). Ini
 * praktik umum di Indonesia untuk memastikan waktu sudah benar-benar masuk,
 * dan sekaligus menyerap selisih pembulatan perhitungan.
 */
export const IHTIYATI_MINUTES = 2;

/** Sudut Kemenag RI (dipakai juga oleh Aladhan sebagai method 20). */
export const KEMENAG_FAJR_ANGLE = 20;
export const KEMENAG_ISHA_ANGLE = 18;

export type PrayerTime = {
  id: PrayerId;
  /** Menit sejak tengah malam waktu LOKAL lokasi (mis. 258 = 04:18). */
  minutes: number;
  /** Kunci i18n nama waktu — core tidak tahu bahasa. */
  labelKey: TranslationKey;
};

export type PrayerSchedule = {
  /** Tanggal lokal lokasi (YYYY-MM-DD). */
  date: string;
  times: readonly PrayerTime[];
};

const LABEL_KEYS: Record<PrayerId, TranslationKey> = {
  subuh: "prayer.subuh",
  syuruq: "prayer.syuruq",
  dzuhur: "prayer.dzuhur",
  ashar: "prayer.ashar",
  maghrib: "prayer.maghrib",
  isya: "prayer.isya",
};

/** "HH:MM" dari menit sejak tengah malam; 1440+ dibawa kembali ke 0..1439. */
export function minutesToClock(minutes: number): string {
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const mm = String(wrapped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function isPrayerId(value: PrayerId): boolean {
  return PRAYER_IDS.includes(value);
}

export type ComputeInput = {
  lat: number;
  lng: number;
  /** Offset zona lokasi dari UTC, dalam menit (WIB 420, WITA 480, WIT 540). */
  tzOffsetMinutes: number;
  /** Tanggal LOKAL lokasi, YYYY-MM-DD. */
  date: string;
};

export type ComputeOptions = {
  /**
   * Tambahan menit pengaman pada lima waktu salat. Default `IHTIYATI_MINUTES`
   * (2) — nilai inilah yang dipakai UI. Boleh 0, dan itu ADA gunanya: test
   * membandingkan hasil mentah (tanpa ihtiyati) dengan referensi luar untuk
   * memisahkan "ketelitian library" dari "pengaman yang kita tambahkan".
   */
  ihtiyatiMinutes?: number;
};

/** Clamp 0..20 bulat; input rusak → default. Pengaman tidak boleh jadi bug baru. */
function normalizeIhtiyati(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return IHTIYATI_MINUTES;
  return Math.min(20, Math.max(0, Math.round(value)));
}

/**
 * Hitung jadwal salat satu hari untuk satu lokasi. Melempar kalau inputnya
 * rusak (tanggal/zona) — pemanggil di UI selalu memberi nilai dari store yang
 * sudah tervalidasi, jadi ini menandai bug, bukan input user.
 */
export function computePrayerTimes(input: ComputeInput, options?: ComputeOptions): PrayerSchedule {
  const { lat, lng, tzOffsetMinutes, date } = input;
  const ihtiyati = normalizeIhtiyati(options?.ihtiyatiMinutes);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(tzOffsetMinutes)) {
    throw new Error("computePrayerTimes: koordinat/zona tidak valid");
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error("computePrayerTimes: koordinat di luar rentang");
  }
  if (tzOffsetMinutes < -720 || tzOffsetMinutes > 840) {
    throw new Error("computePrayerTimes: offset zona di luar rentang");
  }
  const parts = date.split("-").map(Number);
  const [year, month, day] = parts;
  if (parts.length !== 3 || !parts.every(Number.isFinite) || year === undefined || month === undefined || day === undefined) {
    throw new Error(`computePrayerTimes: tanggal tidak valid (${date})`);
  }

  const params = CalculationMethod.Other();
  params.fajrAngle = KEMENAG_FAJR_ANGLE;
  params.ishaAngle = KEMENAG_ISHA_ANGLE;

  // Jangkar tengah hari TANGGAL LOKASI. adhan membaca komponen tanggal jangkar
  // ini dengan getFullYear/getMonth/getDate (waktu LOKAL runtime — lihat
  // lib/cjs/SolarTime.js), jadi jangkar dibuat lewat constructor lokal `new
  // Date(y, m, d, 12)`: komponennya tetap tanggal yang kita mau di zona device
  // mana pun. (Memakai `Date.UTC(...)` di sini akan benar di CI dan di WIB, tapi
  // salah satu hari di device dengan offset negatif — persis jenis bug yang
  // tidak muncul di test.) Hasil adhan sendiri berupa instant UTC di tanggal itu,
  // jadi offset zona lokasi baru dipakai saat mengubah hasil ke jam lokal.
  const anchor = new Date(year, month - 1, day, 12);
  // Guard roll-over: `2026-13-99` terlihat sah bagi Number() tapi diam-diam
  // digeser Date ke tanggal lain (pola yang sama sudah diperbaiki di
  // core/time/wib.ts). Lebih baik melempar daripada menampilkan jadwal hari lain.
  if (
    anchor.getFullYear() !== year ||
    anchor.getMonth() !== month - 1 ||
    anchor.getDate() !== day
  ) {
    throw new Error(`computePrayerTimes: tanggal tidak valid (${date})`);
  }
  const raw = new PrayerTimes(new Coordinates(lat, lng), anchor, params);

  const toMinutes = (value: Date, id: PrayerId): number => {
    const shifted = new Date(value.getTime() + tzOffsetMinutes * 60_000);
    const base = shifted.getUTCHours() * 60 + shifted.getUTCMinutes() + shifted.getUTCSeconds() / 60;
    const rounded = Math.round(base);
    return id === "syuruq" ? rounded : rounded + ihtiyati;
  };

  const sources: [PrayerId, Date][] = [
    ["subuh", raw.fajr],
    ["syuruq", raw.sunrise],
    ["dzuhur", raw.dhuhr],
    ["ashar", raw.asr],
    ["maghrib", raw.maghrib],
    ["isya", raw.isha],
  ];

  const times = sources
    .filter(([id]) => isPrayerId(id))
    .map(([id, value]) => ({ id, minutes: toMinutes(value, id), labelKey: LABEL_KEYS[id] }));

  return { date, times };
}

export function prayerTime(schedule: PrayerSchedule, id: PrayerId): PrayerTime | undefined {
  return schedule.times.find((time) => time.id === id);
}

export type NextPrayer = {
  id: PrayerId;
  /** Menit sejak tengah malam lokal. */
  minutes: number;
  /** Sisa menit dari `nowMinutes` (0 = sudah masuk sekarang). */
  waitMinutes: number;
  /** true kalau waktu ini jatuh besok (tidak ada salat tersisa hari ini). */
  tomorrow: boolean;
};

/**
 * Waktu salat BERIKUTNYA dari `nowMinutes` (menit lokal). Syuruq dilewati —
 * ia penanda, bukan salat. Setelah Isya, jawabannya Subuh besok (memakai jadwal
 * hari ini + 1440; selisih satu-dua menit ke besok tidak berarti untuk hitungan
 * "berapa lama lagi").
 */
export function nextPrayer(schedule: PrayerSchedule, nowMinutes: number): NextPrayer {
  for (const id of OBLIGATORY_PRAYER_IDS) {
    const time = prayerTime(schedule, id);
    if (time === undefined) continue;
    if (time.minutes > nowMinutes) {
      return { id, minutes: time.minutes, waitMinutes: time.minutes - nowMinutes, tomorrow: false };
    }
  }
  const subuh = prayerTime(schedule, "subuh");
  const minutes = (subuh?.minutes ?? 0) + 1440;
  return { id: "subuh", minutes: minutes % 1440, waitMinutes: minutes - nowMinutes, tomorrow: true };
}

/** Jam & menit lokal (dipakai UI untuk "sekarang" dan pengingat). */
export function localClock(date: Date, tzOffsetMinutes: number): { minutes: number; hour: number; minute: number } {
  const shifted = new Date(date.getTime() + tzOffsetMinutes * 60_000);
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  return { minutes: hour * 60 + minute, hour, minute };
}

/**
 * Tanggal LOKAL lokasi (YYYY-MM-DD) untuk satu momen. Dipakai layar salat supaya
 * "hari ini" berarti hari di tempat user berada (WIB/WITA/WIT), bukan hari UTC
 * atau hari WIB — pukul 00:30 WIT masih tanggal yang berbeda dari WIB.
 */
export function localDay(date: Date, tzOffsetMinutes: number): string {
  return new Date(date.getTime() + tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
}
