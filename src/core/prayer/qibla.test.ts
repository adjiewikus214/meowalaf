/**
 * Test core/prayer/qibla — arah kiblat tidak punya sensor untuk dipercaya, jadi
 * satu-satunya pegangan adalah angka acuan. Nilai harapan di bawah adalah bearing
 * great-circle yang bisa diperiksa ulang siapa pun (rumus standar, utara
 * sebenarnya); toleransi 0,01° murni untuk pembulatan, bukan kelonggaran.
 */
import { describe, expect, it } from "vitest";

import {
  KAABA_LAT,
  KAABA_LNG,
  compassPoint,
  distanceKm,
  distanceToKaaba,
  formatBearing,
  qiblaBearing,
  validCoords,
} from "./qibla";

const REFERENCE: readonly { label: string; lat: number; lng: number; bearing: number }[] = [
  { label: "Jakarta", lat: -6.1754, lng: 106.8272, bearing: 295.1461 },
  { label: "Banda Aceh", lat: 5.5483, lng: 95.3238, bearing: 292.1663 },
  { label: "Makassar", lat: -5.1477, lng: 119.4327, bearing: 292.4769 },
  { label: "Jayapura", lat: -2.5916, lng: 140.6691, bearing: 291.3263 },
];

describe("qiblaBearing", () => {
  for (const row of REFERENCE) {
    it(`${row.label}: ${row.bearing}° dari utara`, () => {
      expect(qiblaBearing(row.lat, row.lng)).toBeCloseTo(row.bearing, 2);
    });
  }

  it("selalu di 0..360, termasuk dari titik di barat Ka'bah", () => {
    for (const point of [
      { lat: 0, lng: -150 },
      { lat: -40, lng: 20 },
      { lat: 60, lng: -100 },
      { lat: KAABA_LAT, lng: KAABA_LNG - 1 },
    ]) {
      const bearing = qiblaBearing(point.lat, point.lng);
      expect(bearing).toBeGreaterThanOrEqual(0);
      expect(bearing).toBeLessThan(360);
    }
  });

  it("dari Ka'bah sendiri tetap angka sah (arah tak terdefinisi → bukan NaN)", () => {
    expect(Number.isFinite(qiblaBearing(KAABA_LAT, KAABA_LNG))).toBe(true);
  });

  it("koordinat tidak valid → melempar", () => {
    expect(() => qiblaBearing(Number.NaN, 106)).toThrow();
    expect(() => qiblaBearing(-91, 106)).toThrow();
  });
});

describe("jarak ke Ka'bah", () => {
  it("urutan jarak sesuai geografi Indonesia", () => {
    const aceh = distanceToKaaba(5.5483, 95.3238);
    const jakarta = distanceToKaaba(-6.1754, 106.8272);
    const makassar = distanceToKaaba(-5.1477, 119.4327);
    const jayapura = distanceToKaaba(-2.5916, 140.6691);
    expect(aceh).toBeLessThan(jakarta);
    expect(jakarta).toBeLessThan(makassar);
    expect(makassar).toBeLessThan(jayapura);
  });

  it("jarak ke diri sendiri 0 dan simetris", () => {
    const a = { lat: -6.1754, lng: 106.8272 };
    const b = { lat: 21.4225, lng: 39.8262 };
    expect(distanceKm(a, a)).toBe(0);
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 9);
  });

  it("koordinat tidak valid → melempar", () => {
    expect(() => distanceKm({ lat: Number.NaN, lng: 0 }, { lat: 0, lng: 0 })).toThrow();
  });
});

describe("compassPoint & formatBearing", () => {
  it("membulatkan ke delapan mata angin terdekat", () => {
    expect(compassPoint(0)).toBe("N");
    expect(compassPoint(22)).toBe("N");
    expect(compassPoint(44)).toBe("NE");
    expect(compassPoint(90)).toBe("E");
    expect(compassPoint(180)).toBe("S");
    expect(compassPoint(270)).toBe("W");
    expect(compassPoint(315)).toBe("NW");
    expect(compassPoint(359)).toBe("N");
    // Kiblat Indonesia ada di kuadran barat–barat laut.
    expect(compassPoint(295.1461)).toBe("NW");
  });

  it("formatBearing satu desimal & tahan input rusak", () => {
    expect(formatBearing(295.1461)).toBe("295.1\u00b0");
    expect(formatBearing(-10)).toBe("350.0\u00b0");
    expect(formatBearing(360)).toBe("0.0\u00b0");
    expect(formatBearing(Number.NaN)).toBe("0.0\u00b0");
  });
});

describe("validCoords", () => {
  it("menerima koordinat sah, menolak yang lain", () => {
    expect(validCoords({ lat: -6, lng: 106 })).toEqual({ lat: -6, lng: 106 });
    expect(validCoords(null)).toBeNull();
    expect(validCoords(undefined)).toBeNull();
    expect(validCoords({ lat: Number.NaN, lng: 0 })).toBeNull();
    expect(validCoords({ lat: 0, lng: Number.POSITIVE_INFINITY })).toBeNull();
    expect(validCoords({ lat: 90.5, lng: 0 })).toBeNull();
    expect(validCoords({ lat: 0, lng: -190 })).toBeNull();
  });
});
