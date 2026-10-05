/**
 * Owner: features/reminders. Aturan pengingat harian — PURE & data-only: pilihan
 * jam, normalisasi, konten pesan, dan syarat boleh menawarkan pengingat. Tidak ada
 * import OS di sini (semua "bagaimana cara mengirim" ada di reminder-scheduler.ts).
 *
 * Default setelah maghrib (19:00) — pola ngaji yang paling umum di Indonesia dan
 * tidak menabrak rutinitas pagi. User tetap bebas ganti lewat pilihan jam.
 */

export const MIN_REMINDER_HOUR = 0;
export const MAX_REMINDER_HOUR = 23;
export const DEFAULT_REMINDER_HOUR = 19;

export type ReminderHourChoice = {
  /** Jam lokal device (0..23). */
  hour: number;
  /** Nama waktu — gaya meta-UI, bukan istilah liturgi. */
  label: string;
  hint: string;
};

/** Pilihan jam yang ditawarkan di UI — mengelompokkan per waktu, bukan 24 slider. */
export const REMINDER_HOUR_CHOICES: readonly ReminderHourChoice[] = [
  { hour: 5, label: "subuh", hint: "sebelum matahari terbit" },
  { hour: 12, label: "dzuhur", hint: "sesudah zuhur" },
  { hour: 15, label: "asar", hint: "sesudah asar" },
  { hour: 19, label: "maghrib", hint: "sesudah maghrib — paling pas" },
  { hour: 20, label: "isya", hint: "sesudah isya" },
];

/** Clamp ke 0..23 bulat; input rusak/luar rentang → default (fail-soft, no-op). */
export function normalizeReminderHour(hour: number): number {
  if (!Number.isFinite(hour)) return DEFAULT_REMINDER_HOUR;
  const rounded = Math.round(hour);
  if (rounded < MIN_REMINDER_HOUR || rounded > MAX_REMINDER_HOUR) return DEFAULT_REMINDER_HOUR;
  return rounded;
}

/**
 * Izin notifikasi HANYA ditawarkan setelah lesson pertama (ROADMAP § 4): jangan
 * nagging izin OS sebelum user pernah benar-benar ngaji — itu bahan uninstall
 * di review app store.
 */
export function canOfferReminder(sessionsCompleted: number): boolean {
  return Number.isFinite(sessionsCompleted) && sessionsCompleted >= 1;
}

/** "19:00" — untuk tampilan. */
export function formatReminderHour(hour: number): string {
  return `${String(normalizeReminderHour(hour)).padStart(2, "0")}:00`;
}

/** Pilihan jam yang sedang aktif (atau undefined kalau jam di luar daftar). */
export function reminderChoiceFor(hour: number): ReminderHourChoice | undefined {
  const target = normalizeReminderHour(hour);
  return REMINDER_HOUR_CHOICES.find((choice) => choice.hour === target);
}

/**
 * Isi notifikasi — singkat & ramah (meta-UI, bukan teks ayat: tanpa tafsir, hanya
 * ajakan). Dibagi per rentang jam supaya terasa relevan dengan waktu user.
 */
export function reminderContent(hour: number): { title: string; body: string } {
  const h = normalizeReminderHour(hour);
  if (h < 11) {
    return { title: "ayo, subuh dulu", body: "sisa waktu subuh masih ada — satu ayat pun bernilai." };
  }
  if (h < 15) {
    return { title: "zuhur sudah masuk", body: "sambil nunggu asar, kebangan satu ayat ya." };
  }
  if (h < 18) {
    return { title: "asar udah lewat", body: "tiga menit buat jaga streak — worth it." };
  }
  if (h < 20) {
    return { title: "maghrib sudah masuk", body: "waktunya ngaji, biar streak tetap aman." };
  }
  return { title: "isya belum selesai", body: "masih sempat satu ayat sebelum tidur." };
}