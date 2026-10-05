/**
 * Test features/prayer/prayer-plan — bagian yang menentukan "lokasi mana yang
 * dipakai" dan "notifikasi apa yang dijadwalkan". Keduanya tidak bisa diuji di
 * device sekarang (GPS & notifikasi), jadi aturannya dikunci di sini.
 */
import { describe, expect, it } from "vitest";

import { computePrayerTimes } from "@/core/prayer/times";

import {
  formatCountdown,
  formatLocationLabel,
  prayerPlanSignature,
  prayerReminderPlan,
  resolveLocation,
  type PrayerLocationState,
} from "./prayer-plan";

const CITY_STATE: PrayerLocationState = {
  cityId: "makassar",
  source: "city",
  gps: null,
  notificationsEnabled: false,
};

describe("resolveLocation — jalur kota manual", () => {
  it("memakai koordinat & zona kota yang dipilih", () => {
    const location = resolveLocation(CITY_STATE);
    expect(location).toMatchObject({
      cityId: "makassar",
      source: "city",
      tzOffsetMinutes: 480,
      approxKm: null,
    });
    expect(location.lat).toBeCloseTo(-5.1477, 4);
  });

  it("id kota tak dikenal → kota default, bukan crash", () => {
    const location = resolveLocation({ ...CITY_STATE, cityId: "atlantis" });
    expect(location.cityId).toBe("jakarta");
    expect(location.tzOffsetMinutes).toBe(420);
  });
});

describe("resolveLocation — jalur GPS", () => {
  it("pakai koordinat GPS, zona dari kota terdekat", () => {
    const location = resolveLocation({
      ...CITY_STATE,
      source: "gps",
      gps: { lat: -5.1, lng: 119.45, accuracyM: 12, at: 1 },
    });
    expect(location.source).toBe("gps");
    expect(location.lat).toBeCloseTo(-5.1, 4);
    expect(location.cityId).toBe("makassar");
    expect(location.tzOffsetMinutes).toBe(480);
    expect(location.approxKm ?? Infinity).toBeLessThan(30);
  });

  it("GPS di luar ibu kota tetap dapat zona yang benar (Bandung → WIB)", () => {
    const location = resolveLocation({
      ...CITY_STATE,
      source: "gps",
      gps: { lat: -6.9175, lng: 107.6191, accuracyM: 20, at: 1 },
    });
    expect(location.cityId).toBe("bandung");
    expect(location.tzOffsetMinutes).toBe(420);
  });

  it("fix rusak / belum ada → kembali ke kota manual (layar tidak pernah kosong)", () => {
    const broken = resolveLocation({
      ...CITY_STATE,
      source: "gps",
      gps: { lat: Number.NaN, lng: 119, accuracyM: null, at: 1 },
    });
    expect(broken.source).toBe("city");
    expect(broken.cityId).toBe("makassar");

    const empty = resolveLocation({ ...CITY_STATE, source: "gps", gps: null });
    expect(empty.source).toBe("city");
  });
});

describe("prayerReminderPlan", () => {
  const schedule = computePrayerTimes({
    lat: -6.1754,
    lng: 106.8272,
    tzOffsetMinutes: 420,
    date: "2026-10-05",
  });

  it("lima permintaan, jam/menit dari jadwal hari itu (termasuk ihtiyati)", () => {
    const plan = prayerReminderPlan(schedule, "id");
    expect(plan.map((entry) => entry.id)).toEqual(["subuh", "dzuhur", "ashar", "maghrib", "isya"]);
    expect(plan[0]).toMatchObject({ id: "subuh", hour: 4, minute: 20 });
    expect(plan[4]).toMatchObject({ id: "isya", hour: 18, minute: 58 });
  });

  it("isi pesan ikut bahasa user, dan tidak kosong", () => {
    const id = prayerReminderPlan(schedule, "id");
    const en = prayerReminderPlan(schedule, "en");
    for (const entry of [...id, ...en]) {
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.body.length).toBeGreaterThan(0);
    }
    expect(id[0]?.title).not.toBe(en[0]?.title);
  });

  it("signature stabil untuk jadwal sama, berubah kalau tanggal/waktu bergeser", () => {
    const plan = prayerReminderPlan(schedule, "id");
    expect(prayerPlanSignature(schedule, plan)).toBe(prayerPlanSignature(schedule, plan));

    const tomorrow = computePrayerTimes({
      lat: -6.1754,
      lng: 106.8272,
      tzOffsetMinutes: 420,
      date: "2026-10-06",
    });
    expect(prayerPlanSignature(tomorrow, prayerReminderPlan(tomorrow, "id"))).not.toBe(
      prayerPlanSignature(schedule, plan),
    );
  });

  it("kota berbeda pada tanggal sama → signature berbeda (ganti kota wajib menata ulang notifikasi OS)", () => {
    const makassar = computePrayerTimes({
      lat: -5.1477,
      lng: 119.4327,
      tzOffsetMinutes: 480,
      date: "2026-10-05",
    });
    expect(prayerPlanSignature(makassar, prayerReminderPlan(makassar, "id"))).not.toBe(
      prayerPlanSignature(schedule, prayerReminderPlan(schedule, "id")),
    );
  });
});

describe("formatCountdown", () => {
  const base = { id: "ashar" as const, minutes: 900, tomorrow: false };
  it("menit, jam, dan campuran", () => {
    expect(formatCountdown({ ...base, waitMinutes: 0 }, "id")).toBe("sekarang");
    expect(formatCountdown({ ...base, waitMinutes: -3 }, "id")).toBe("sekarang");
    expect(formatCountdown({ ...base, waitMinutes: 1 }, "id")).toContain("1 menit");
    expect(formatCountdown({ ...base, waitMinutes: 59 }, "id")).toContain("59 menit");
    expect(formatCountdown({ ...base, waitMinutes: 60 }, "id")).toContain("1 jam");
    expect(formatCountdown({ ...base, waitMinutes: 61 }, "id")).toContain("1 jam 1 menit");
    expect(formatCountdown({ ...base, waitMinutes: 125 }, "id")).toContain("2 jam 5 menit");
    expect(formatCountdown({ ...base, waitMinutes: 61 }, "en")).toContain("1 h");
  });
});

describe("formatLocationLabel", () => {
  const schedule = { date: "2026-10-05", times: [] };

  it("kota manual → nama kota saja", () => {
    expect(formatLocationLabel(resolveLocation(CITY_STATE), "id")).toBe("Makassar");
  });

  it("GPS → diberi awalan 'sekitar' + nama kota acuan zona", () => {
    const location = resolveLocation({
      ...CITY_STATE,
      source: "gps",
      gps: { lat: -6.9175, lng: 107.6191, accuracyM: 15, at: 1 },
    });
    const label = formatLocationLabel(location, "id");
    expect(label).toContain("Bandung");
    expect(label.toLowerCase()).toContain("sekitar");
    expect(schedule.date).toBe("2026-10-05");
  });
});
