import { describe, expect, it } from "vitest";

import { getLessonUnit, getUnitCount } from "./units";

describe("getUnitCount", () => {
  it("Al-Fatihah (7 ayat) = 1 unit", () => {
    expect(getUnitCount(1)).toBe(1);
  });

  it("Al-Baqarah (286 ayat) = 41 unit (ceil)", () => {
    expect(getUnitCount(2)).toBe(41);
  });

  it("surah tak dikenal → undefined", () => {
    expect(getUnitCount(0)).toBeUndefined();
    expect(getUnitCount(115)).toBeUndefined();
  });
});

describe("getLessonUnit", () => {
  it("unit tunggal mencakup seluruh surah pendek", () => {
    const unit = getLessonUnit(1, 0); // Al-Fatihah 7 ayat
    expect(unit).toEqual({ unitIndex: 0, unitCount: 1, startAyah: 1, endAyah: 7, ayahCount: 7 });
  });

  it("unit ≤ 7 ayat di surah panjang (Al-Baqarah 286 ayat)", () => {
    const unitCount = getUnitCount(2) ?? 0;
    expect(unitCount).toBe(41);
    for (let i = 0; i < unitCount; i++) {
      const unit = getLessonUnit(2, i);
      expect(unit).toBeDefined();
      expect(unit?.ayahCount).toBeLessThanOrEqual(7);
      expect(unit?.ayahCount).toBeGreaterThanOrEqual(3);
    }
  });

  it("unit berurutan tanpa lubang dan tanpa tumpang-tindih (An-Nisa 176 ayat)", () => {
    const unitCount = getUnitCount(4) ?? 0;
    let expectedStart = 1;
    for (let i = 0; i < unitCount; i++) {
      const unit = getLessonUnit(4, i);
      expect(unit?.startAyah).toBe(expectedStart);
      expectedStart = (unit?.endAyah ?? 0) + 1;
    }
    expect(expectedStart - 1).toBe(176);
  });

  it("unit di luar jangkauan → undefined", () => {
    expect(getLessonUnit(1, 1)).toBeUndefined();
    expect(getLessonUnit(1, -1)).toBeUndefined();
    expect(getLessonUnit(999, 0)).toBeUndefined();
  });
});
