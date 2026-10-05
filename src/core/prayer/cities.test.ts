/**
 * Test core/prayer/cities — daftar lokasi fallback. Yang dijaga di sini adalah
 * sifat yang kalau rusak tidak kelihatan di UI: id unik (nilai store), koordinat
 * dalam rentang Indonesia, zona waktu hanya satu dari tiga nilai sah, dan
 * `nearestCity` benar-benar mengembalikan kota yang paling dekat (bukan pertama
 * di daftar).
 */
import { describe, expect, it } from "vitest";

import { validCoords } from "./qibla";
import {
  DEFAULT_CITY_ID,
  PRAYER_CITIES,
  defaultCity,
  getCity,
  nearestCity,
  searchCities,
} from "./cities";

const OFFSETS = [420, 480, 540];

describe("isi daftar", () => {
  it("38 ibu kota provinsi, id unik, provinsi unik", () => {
    expect(PRAYER_CITIES).toHaveLength(38);
    expect(new Set(PRAYER_CITIES.map((c) => c.id)).size).toBe(38);
    expect(new Set(PRAYER_CITIES.map((c) => c.province)).size).toBe(38);
  });

  it("koordinat sah, di wilayah Indonesia, dan zona waktu dikenal", () => {
    for (const city of PRAYER_CITIES) {
      expect(validCoords(city), city.id).not.toBeNull();
      expect(city.lat, city.id).toBeGreaterThan(-11.5);
      expect(city.lat, city.id).toBeLessThan(6.5);
      expect(city.lng, city.id).toBeGreaterThan(94.5);
      expect(city.lng, city.id).toBeLessThan(141.5);
      expect(OFFSETS, city.id).toContain(city.tzOffsetMinutes);
    }
  });

  it("diurutkan menurut nama supaya daftar pilihan tidak terlihat acak", () => {
    for (let i = 1; i < PRAYER_CITIES.length; i += 1) {
      const previous = PRAYER_CITIES[i - 1]?.name ?? "";
      const current = PRAYER_CITIES[i]?.name ?? "";
      expect(previous <= current, `${previous} harus sebelum ${current}`).toBe(true);
    }
  });

  it("zona barat/tengah/timur semuanya terwakili", () => {
    for (const offset of OFFSETS) {
      expect(PRAYER_CITIES.some((city) => city.tzOffsetMinutes === offset), String(offset)).toBe(true);
    }
  });
});

describe("getCity & defaultCity", () => {
  it("mengambil kota menurut id", () => {
    expect(getCity("jakarta")?.name).toBe("Jakarta");
    expect(getCity("tidak-ada")).toBeUndefined();
  });

  it("kota default selalu ada", () => {
    expect(defaultCity().id).toBe(DEFAULT_CITY_ID);
  });
});

describe("nearestCity", () => {
  it("setiap kota adalah kota terdekat bagi dirinya sendiri", () => {
    for (const city of PRAYER_CITIES) {
      const match = nearestCity({ lat: city.lat, lng: city.lng });
      expect(match?.city.id).toBe(city.id);
      expect(match?.distanceKm ?? 1).toBeCloseTo(0, 6);
    }
  });

  it("titik GPS di darat memilih kota yang masuk akal + jaraknya", () => {
    const surabaya = nearestCity({ lat: -7.2575, lng: 112.7521 });
    expect(surabaya?.city.id).toBe("surabaya");
    expect(surabaya?.city.tzOffsetMinutes).toBe(420);

    const makassar = nearestCity({ lat: -4.9, lng: 119.4 });
    expect(makassar?.city.id).toBe("makassar");
    expect(makassar?.city.tzOffsetMinutes).toBe(480);

    const jayapura = nearestCity({ lat: -2.7, lng: 140.8 });
    expect(jayapura?.city.id).toBe("jayapura");
    expect(jayapura?.city.tzOffsetMinutes).toBe(540);
  });

  it("koordinat rusak → null (bukan kota pertama secara asal)", () => {
    expect(nearestCity(null)).toBeNull();
    expect(nearestCity({ lat: Number.NaN, lng: 0 })).toBeNull();
    expect(nearestCity({ lat: 0, lng: 500 })).toBeNull();
  });
});

describe("searchCities", () => {
  it("query kosong = semua kota (user memang mau melihat pilihannya)", () => {
    expect(searchCities("")).toHaveLength(38);
    expect(searchCities("   ")).toHaveLength(38);
  });

  it("cocok pada nama & provinsi, tanpa peduli besar-kecil huruf", () => {
    expect(searchCities("jawa").map((c) => c.id).sort()).toEqual(["bandung", "semarang", "surabaya"]);
    expect(searchCities("banda").map((c) => c.id).sort()).toEqual(["banda-aceh", "bandar-lampung"]);
    expect(searchCities("PAPUA")).toHaveLength(6);
    expect(searchCities("zzz")).toHaveLength(0);
  });
});
