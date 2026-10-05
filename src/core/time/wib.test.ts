import { describe, expect, it } from "vitest";

import { diffDays, toWibDate } from "./wib";

describe("toWibDate", () => {
  it("menggeser UTC 17:00 ke hari berikutnya di WIB (lintas midnight)", () => {
    // 2026-03-10T17:00:00Z = 2026-03-11 00:00 WIB
    expect(toWibDate(new Date("2026-03-10T17:00:00Z"))).toBe("2026-03-11");
  });

  it("UTC 16:59 masih hari yang sama di WIB", () => {
    expect(toWibDate(new Date("2026-03-10T16:59:59Z"))).toBe("2026-03-10");
  });

  it("tidak terpengaruh timezone device (deterministik)", () => {
    const instant = new Date("2026-01-01T00:30:00Z");
    // WIB: 07:30 pada 1 Jan
    expect(toWibDate(instant)).toBe("2026-01-01");
  });

  it("lintas tahun baru WIB", () => {
    // 2025-12-31T17:00:00Z = 2026-01-01 00:00 WIB
    expect(toWibDate(new Date("2025-12-31T17:00:00Z"))).toBe("2026-01-01");
  });
});

describe("diffDays", () => {
  it("satu hari", () => {
    expect(diffDays("2026-03-10", "2026-03-11")).toBe(1);
  });
  it("mundur negatif", () => {
    expect(diffDays("2026-03-11", "2026-03-10")).toBe(-1);
  });
  it("nol untuk hari sama", () => {
    expect(diffDays("2026-03-10", "2026-03-10")).toBe(0);
  });
});
