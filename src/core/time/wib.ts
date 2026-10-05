/**
 * Owner: core/time. Semua logika "hari" produk memakai WIB (UTC+7) —
 * aturan RULES.md § 3: dilarang `new Date()` tanpa sadar zona untuk streak/quest.
 */

export function toWibDate(date: Date = new Date()): string {
  const utcMs = date.getTime() + 7 * 60 * 60 * 1000;
  const shifted = new Date(utcMs);
  return shifted.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function todayWib(): string {
  return toWibDate(new Date());
}

export function diffDays(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Geser satu tanggal YYYY-MM-DD sebanyak `delta` hari (boleh negatif).
 * Aritmetika murni di UTC atas "tengah malam tanggal" — JANGAN pakai
 * `new Date("YYYY-MM-DD")` karena itu di-parse sebagai UTC midnight lalu
 * diformat ulang dalam zona lokal, jadi bisa geser satu hari di wkto/GMT+.
 */
export function shiftWibDay(day: string, delta: number): string {
  const base = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(base)) return day; // fail-soft: input rusak → jangan bergeser
  return new Date(base + delta * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Jumlah hari sejak epoch dari tanggal `YYYY-MM-DD`, atau `null` kalau tidak sah.
 *
 * Dipakai untuk rotasi konten harian (tip, hadis): hari yang sama selalu memilih
 * entri yang sama, tanpa state/persistensi apa pun.
 *
 * Guard roll-over itu bukan hiasan: tanpa cek `new Date(ms).toISOString()`,
 * input seperti `2026-13-99` diam-diam di-roll-over `Date` menjadi `2027-04-09`
 * yang terlihat sah, sehingga konten harian menampilkan entri milik hari lain dan
 * tidak ada satu pun test yang menangkapnya.
 */
export function epochDays(day: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (match === null) return null;
  const [, year, month, date] = match;
  const ms = Date.UTC(Number(year), Number(month) - 1, Number(date));
  if (Number.isNaN(ms)) return null;
  if (new Date(ms).toISOString().slice(0, 10) !== day) return null;
  return Math.floor(ms / 86_400_000);
}
