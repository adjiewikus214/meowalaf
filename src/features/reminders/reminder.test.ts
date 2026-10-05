/**
 * Test features/reminders/reminder — aturan PURE pengingat harian (tanpa OS,
 * tanpa AsyncStorage; yang diuji di sini murni angka & teks). Gate utama: default
 * setelah maghrib, input rusak tidak pernah jadi jam ngawur, dan izin hanya boleh
 * ditawarkan setelah lesson pertama.
 */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_REMINDER_HOUR,
  MAX_REMINDER_HOUR,
  MIN_REMINDER_HOUR,
  REMINDER_HOUR_CHOICES,
  canOfferReminder,
  formatReminderHour,
  normalizeReminderHour,
  reminderChoiceFor,
  reminderContent,
} from "./reminder";

describe("preset jam pengingat", () => {
  it("default setelah maghrib (19:00) — ROADMAP § 4", () => {
    expect(DEFAULT_REMINDER_HOUR).toBe(19);
    expect(reminderChoiceFor(DEFAULT_REMINDER_HOUR)?.label).toBe("maghrib");
  });

  it("pilihan jam urut & semua valid + punya label", () => {
    expect(REMINDER_HOUR_CHOICES.length).toBeGreaterThanOrEqual(5);
    const hours = REMINDER_HOUR_CHOICES.map((choice) => choice.hour);
    expect(hours).toEqual([...hours].sort((a, b) => a - b));
    for (const choice of REMINDER_HOUR_CHOICES) {
      expect(choice.hour).toBeGreaterThanOrEqual(MIN_REMINDER_HOUR);
      expect(choice.hour).toBeLessThanOrEqual(MAX_REMINDER_HOUR);
      expect(choice.label.length).toBeGreaterThan(0);
      expect(choice.hint.length).toBeGreaterThan(0);
    }
  });

  it("tidak ada jam duplikat", () => {
    const hours = REMINDER_HOUR_CHOICES.map((choice) => choice.hour);
    expect(new Set(hours).size).toBe(hours.length);
  });
});

describe("normalizeReminderHour", () => {
  it("mempertahankan jam valid", () => {
    expect(normalizeReminderHour(0)).toBe(0);
    expect(normalizeReminderHour(5)).toBe(5);
    expect(normalizeReminderHour(23)).toBe(23);
  });

  it("membulatkan pecahan", () => {
    expect(normalizeReminderHour(19.4)).toBe(19);
    expect(normalizeReminderHour(19.6)).toBe(20);
  });

  it("di luar rentang / rusak → default (tidak pernah jam ngawur)", () => {
    expect(normalizeReminderHour(-1)).toBe(DEFAULT_REMINDER_HOUR);
    expect(normalizeReminderHour(24)).toBe(DEFAULT_REMINDER_HOUR);
    expect(normalizeReminderHour(999)).toBe(DEFAULT_REMINDER_HOUR);
    expect(normalizeReminderHour(Number.NaN)).toBe(DEFAULT_REMINDER_HOUR);
    expect(normalizeReminderHour(Number.POSITIVE_INFINITY)).toBe(DEFAULT_REMINDER_HOUR);
  });
});

describe("canOfferReminder (izin setelah lesson pertama)", () => {
  it("belum ada sesi → jangan menawarkan", () => {
    expect(canOfferReminder(0)).toBe(false);
    expect(canOfferReminder(-3)).toBe(false);
  });

  it("sudah ≥1 sesi → boleh", () => {
    expect(canOfferReminder(1)).toBe(true);
    expect(canOfferReminder(42)).toBe(true);
  });

  it("NaN → konservatif (tidak menawarkan)", () => {
    expect(canOfferReminder(Number.NaN)).toBe(false);
  });
});

describe("formatReminderHour", () => {
  it("dua digit dengan nol di depan", () => {
    expect(formatReminderHour(5)).toBe("05:00");
    expect(formatReminderHour(19)).toBe("19:00");
    expect(formatReminderHour(0)).toBe("00:00");
  });

  it("input rusak tetap format valid", () => {
    expect(formatReminderHour(Number.NaN)).toBe("19:00");
  });
});

describe("reminderChoiceFor", () => {
  it("mencetak choice yang cocok", () => {
    expect(reminderChoiceFor(5)?.label).toBe("subuh");
    expect(reminderChoiceFor(20)?.label).toBe("isya");
  });

  it("jam di luar daftar → undefined (UI fallback ke format jam)", () => {
    expect(reminderChoiceFor(3)).toBeUndefined();
  });
});

describe("reminderContent", () => {
  it("selalu punya title & body non-kosong, apa pun jamnya", () => {
    for (let hour = 0; hour <= 23; hour += 1) {
      const { title, body } = reminderContent(hour);
      expect(title.length).toBeGreaterThan(0);
      expect(body.length).toBeGreaterThan(0);
    }
  });

  it("berbeda per rentang waktu (subuh ≠ maghrib ≠ isya)", () => {
    const subuh = reminderContent(5);
    const maghrib = reminderContent(19);
    const isya = reminderContent(20);
    expect(subuh.title).not.toBe(maghrib.title);
    expect(maghrib.title).not.toBe(isya.title);
  });

  it("jam default (maghrib) memakai nada 'maghrib'", () => {
    expect(reminderContent(DEFAULT_REMINDER_HOUR).title).toContain("maghrib");
  });

  it("jam rusak → jatuh ke konten default, tidak crash", () => {
    expect(reminderContent(Number.NaN).title).toBe(reminderContent(DEFAULT_REMINDER_HOUR).title);
  });
});