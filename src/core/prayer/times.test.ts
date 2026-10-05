/**
 * Test core/prayer/times — angka yang menyangkut ibadah, jadi tidak boleh "kira-kira".
 *
 * Referensi: Aladhan API `method=20` (Kementerian Agama RI) + `school=0`, diambil
 * per kota per tanggal. Tabelnya ditulis penuh di sini (bukan SATU angka contoh)
 * supaya kesalahan yang hanya muncul di lintang/zona tertentu ikut tertangkap.
 *
 * Ada DUA pengukuran, dan membedakannya itu intinya:
 *   1. **Hasil mentah** (`ihtiyatiMinutes: 0`) vs referensi: menilai ketelitian
 *      perhitungannya sendiri. Diukur: selisih terbesar 2 menit (Ashar), sisanya
 *      0–1 menit.
 *   2. **Jadwal yang tampil** (default, +ihtiyati 2): harus TIDAK PERNAH lebih
 *      awal dari referensi — itu janji ibadahnya, bukan soal enak-enakan. Diukur:
 *      rentang 0..+4 menit.
 * Kalau pengukuran pertama diperlonggar sampai 4 menit, bug rumus yang nyata
 * (mis. Ashar meleset belasan menit — lihat ADR-010) akan lolos.
 */
import { describe, expect, it } from "vitest";

import {
  IHTIYATI_MINUTES,
  OBLIGATORY_PRAYER_IDS,
  PRAYER_IDS,
  computePrayerTimes,
  localClock,
  localDay,
  minutesToClock,
  nextPrayer,
  prayerTime,
  type PrayerId,
} from "./times";

const TOLERANCE_MINUTES = 2;

type ReferenceRow = {
  label: string;
  lat: number;
  lng: number;
  tzOffsetMinutes: number;
  date: string;
  /** Urutan: subuh, syuruq, dzuhur, ashar, maghrib, isya. */
  expected: readonly [string, string, string, string, string, string];
};

const REFERENCE: readonly ReferenceRow[] = [
  {
    label: "Jakarta 5 Okt 2026",
    lat: -6.1754,
    lng: 106.8272,
    tzOffsetMinutes: 420,
    date: "2026-10-05",
    expected: ["04:18", "05:36", "11:41", "14:43", "17:47", "18:56"],
  },
  {
    label: "Jakarta 21 Des 2026",
    lat: -6.1754,
    lng: 106.8272,
    tzOffsetMinutes: 420,
    date: "2026-12-21",
    expected: ["04:11", "05:36", "11:51", "15:18", "18:05", "19:21"],
  },
  {
    label: "Banda Aceh 5 Okt 2026",
    lat: 5.5483,
    lng: 95.3238,
    tzOffsetMinutes: 420,
    date: "2026-10-05",
    expected: ["05:09", "06:26", "12:27", "15:43", "18:29", "19:38"],
  },
  {
    label: "Banda Aceh 21 Des 2026",
    lat: 5.5483,
    lng: 95.3238,
    tzOffsetMinutes: 420,
    date: "2026-12-21",
    expected: ["05:19", "06:43", "12:37", "15:59", "18:31", "19:46"],
  },
  {
    label: "Makassar 5 Okt 2026",
    lat: -5.1477,
    lng: 119.4327,
    tzOffsetMinutes: 480,
    date: "2026-10-05",
    expected: ["04:28", "05:46", "11:51", "14:52", "17:56", "19:05"],
  },
  {
    label: "Makassar 21 Des 2026",
    lat: -5.1477,
    lng: 119.4327,
    tzOffsetMinutes: 480,
    date: "2026-12-21",
    expected: ["04:22", "05:47", "12:00", "15:27", "18:13", "19:29"],
  },
  {
    label: "Jayapura 5 Okt 2026",
    lat: -2.5916,
    lng: 140.6691,
    tzOffsetMinutes: 540,
    date: "2026-10-05",
    expected: ["04:05", "05:22", "11:26", "14:32", "17:30", "18:39"],
  },
  {
    label: "Jayapura 21 Des 2026",
    lat: -2.5916,
    lng: 140.6691,
    tzOffsetMinutes: 540,
    date: "2026-12-21",
    expected: ["04:03", "05:27", "11:35", "15:02", "17:43", "18:59"],
  },
];

function clockToMinutes(clock: string): number {
  const [hh, mm] = clock.split(":").map(Number);
  return (hh ?? 0) * 60 + (mm ?? 0);
}

describe("computePrayerTimes — cocok dengan referensi Kemenag (Aladhan method 20)", () => {
  for (const row of REFERENCE) {
    it(`${row.label}: hasil mentah dalam ${TOLERANCE_MINUTES} menit, yang tampil tidak pernah lebih awal`, () => {
      const base = { lat: row.lat, lng: row.lng, tzOffsetMinutes: row.tzOffsetMinutes, date: row.date };
      const raw = computePrayerTimes(base, { ihtiyatiMinutes: 0 });
      const shown = computePrayerTimes(base);

      const rawMinutes = PRAYER_IDS.map((id) => prayerTime(raw, id)?.minutes ?? NaN);
      const shownMinutes = PRAYER_IDS.map((id) => prayerTime(shown, id)?.minutes ?? NaN);

      PRAYER_IDS.forEach((id, index) => {
        const expected = clockToMinutes(row.expected[index] ?? "00:00");
        const rawDiff = Math.round(rawMinutes[index] ?? NaN) - expected;
        const shownDiff = (shownMinutes[index] ?? NaN) - expected;

        // 1. Ketelitian perhitungan (tanpa pengaman kita).
        expect(Math.abs(rawDiff), `${row.label} · ${id} mentah ${rawDiff} menit`).toBeLessThanOrEqual(
          TOLERANCE_MINUTES,
        );
        // 2. Yang user lihat: pengaman hanya boleh MENAMBAH (arah aman).
        expect(shownDiff, `${row.label} · ${id} tampil ${shownDiff} menit`).toBeGreaterThanOrEqual(0);
      });

      // Urutan wajib benar — kalau ini gagal, yang rusak bukan pembulatan.
      for (let i = 1; i < rawMinutes.length; i += 1) {
        expect(rawMinutes[i] ?? 0).toBeGreaterThan(rawMinutes[i - 1] ?? 0);
      }
    });
  }

  it("tanggal yang diminta dipakai apa adanya (bukan 'hari ini')", () => {
    const schedule = computePrayerTimes({
      lat: -6.1754,
      lng: 106.8272,
      tzOffsetMinutes: 420,
      date: "2026-12-21",
    });
    expect(schedule.date).toBe("2026-12-21");
    expect(schedule.times).toHaveLength(PRAYER_IDS.length);
  });

  it("zona lokasi menggeser jam, bukan tanggal perhitungannya", () => {
    const wib = computePrayerTimes({
      lat: -5.1477,
      lng: 119.4327,
      tzOffsetMinutes: 420,
      date: "2026-10-05",
    });
    const wita = computePrayerTimes({
      lat: -5.1477,
      lng: 119.4327,
      tzOffsetMinutes: 480,
      date: "2026-10-05",
    });
    expect((prayerTime(wita, "dzuhur")?.minutes ?? 0) - (prayerTime(wib, "dzuhur")?.minutes ?? 0)).toBe(60);
  });
});

describe("ihtiyati — pengaman yang harus benar-benar ada", () => {
  const base = {
    lat: -6.1754,
    lng: 106.8272,
    tzOffsetMinutes: 420,
    date: "2026-10-05",
  };

  it("lima waktu salat +2 menit; syuruq TIDAK (bukan waktu salat)", () => {
    const raw = computePrayerTimes(base, { ihtiyatiMinutes: 0 });
    const displayed = computePrayerTimes(base);

    for (const id of OBLIGATORY_PRAYER_IDS) {
      const rawMinutes = prayerTime(raw, id)?.minutes ?? 0;
      const shownMinutes = prayerTime(displayed, id)?.minutes ?? 0;
      expect(shownMinutes - rawMinutes, `ihtiyati ${id}`).toBe(IHTIYATI_MINUTES);
    }

    expect(prayerTime(displayed, "syuruq")?.minutes).toBe(prayerTime(raw, "syuruq")?.minutes);
  });

  it("ihtiyati 0 valid (dipakai test referensi), nilai rusak jatuh ke default", () => {
    const zero = computePrayerTimes(base, { ihtiyatiMinutes: 0 });
    const broken = computePrayerTimes(base, { ihtiyatiMinutes: Number.NaN });
    const negative = computePrayerTimes(base, { ihtiyatiMinutes: -5 });
    expect(prayerTime(broken, "subuh")?.minutes).toBe(prayerTime(computePrayerTimes(base), "subuh")?.minutes);
    expect(prayerTime(negative, "subuh")?.minutes).toBe(prayerTime(zero, "subuh")?.minutes);
  });
});

describe("minutesToClock", () => {
  it("memformat menit jadi HH:MM dan membawa 1440+ kembali ke awal hari", () => {
    expect(minutesToClock(258)).toBe("04:18");
    expect(minutesToClock(0)).toBe("00:00");
    expect(minutesToClock(1440)).toBe("00:00");
    expect(minutesToClock(1445)).toBe("00:05");
    expect(minutesToClock(1439.6)).toBe("00:00");
  });
});

describe("nextPrayer", () => {
  const schedule = computePrayerTimes({
    lat: -6.1754,
    lng: 106.8272,
    tzOffsetMinutes: 420,
    date: "2026-10-05",
  });

  it("sebelum subuh → subuh hari ini", () => {
    expect(nextPrayer(schedule, 0)).toMatchObject({ id: "subuh", tomorrow: false });
  });

  it("tepat saat waktu masuk → sudah dianggap lewat (batas ketat)", () => {
    const subuh = prayerTime(schedule, "subuh")?.minutes ?? 0;
    expect(nextPrayer(schedule, subuh).id).toBe("dzuhur");
  });

  it("syuruq tidak pernah jadi jawaban — ia penanda, bukan salat", () => {
    const syuruq = prayerTime(schedule, "syuruq")?.minutes ?? 0;
    expect(nextPrayer(schedule, syuruq - 5).id).toBe("dzuhur");
    expect(nextPrayer(schedule, syuruq + 5).id).toBe("dzuhur");
  });

  it("setelah isya → subuh besok, tanpa menunggu jadwal besok dihitung", () => {
    const isya = prayerTime(schedule, "isya")?.minutes ?? 0;
    const subuh = prayerTime(schedule, "subuh")?.minutes ?? 0;
    const next = nextPrayer(schedule, isya + 30);
    expect(next.id).toBe("subuh");
    expect(next.tomorrow).toBe(true);
    expect(next.minutes).toBe(subuh);
    expect(next.waitMinutes).toBe(subuh + 1440 - (isya + 30));
  });

  it("waitMinutes tidak pernah negatif untuk semua titik uji", () => {
    for (let now = 0; now < 1440; now += 7) {
      expect(nextPrayer(schedule, now).waitMinutes).toBeGreaterThan(0);
    }
  });
});

describe("localClock & localDay", () => {
  it("localClock memakai offset lokasi, bukan zona device", () => {
    const instant = new Date(Date.UTC(2026, 9, 4, 17, 30)); // 5 Okt 00:30 WIB
    expect(localClock(instant, 420).minutes).toBe(30);
    expect(localClock(instant, 0).minutes).toBe(17 * 60 + 30);
  });

  it("localDay berganti tanggal mengikuti zona lokasi", () => {
    const instant = new Date(Date.UTC(2026, 9, 4, 17, 30));
    expect(localDay(instant, 420)).toBe("2026-10-05");
    expect(localDay(instant, 0)).toBe("2026-10-04");
    // 15:00 UTC + 9 jam = tengah malam WIT → sudah tanggal berikutnya.
    expect(localDay(new Date(Date.UTC(2026, 9, 4, 15, 0)), 540)).toBe("2026-10-05");
  });
});

describe("input rusak → melempar (bug pemanggil, bukan input user)", () => {
  const valid = { lat: -6.1754, lng: 106.8272, tzOffsetMinutes: 420, date: "2026-10-05" };

  it("koordinat tidak wajar", () => {
    expect(() => computePrayerTimes({ ...valid, lat: Number.NaN })).toThrow();
    expect(() => computePrayerTimes({ ...valid, lat: 91 })).toThrow();
    expect(() => computePrayerTimes({ ...valid, lng: 200 })).toThrow();
  });

  it("zona waktu di luar rentang", () => {
    expect(() => computePrayerTimes({ ...valid, tzOffsetMinutes: 1000 })).toThrow();
  });

  it("tanggal tidak sah, termasuk yang di-roll-over Date (2026-13-99)", () => {
    expect(() => computePrayerTimes({ ...valid, date: "2026-13-99" })).toThrow();
    expect(() => computePrayerTimes({ ...valid, date: "bukan-tanggal" })).toThrow();
    expect(() => computePrayerTimes({ ...valid, date: "2026-02-30" })).toThrow();
  });
});

describe("zona device tidak memengaruhi hasil (checklist QA §1 T4 / N3)", () => {
  it("hasil identik walau process.env.TZ diubah ke zona lain", () => {
    const input = { lat: -6.1754, lng: 106.8272, tzOffsetMinutes: 420, date: "2026-10-05" };
    const baseline = computePrayerTimes(input);
    const original = process.env.TZ;
    try {
      process.env.TZ = "America/New_York";
      const newYork = computePrayerTimes(input);
      process.env.TZ = "Pacific/Auckland";
      const auckland = computePrayerTimes(input);
      expect(newYork).toEqual(baseline);
      expect(auckland).toEqual(baseline);
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});

describe("label i18n ikut waktu", () => {
  it("setiap waktu punya kunci label sendiri", () => {
    const schedule = computePrayerTimes({
      lat: -6.1754,
      lng: 106.8272,
      tzOffsetMinutes: 420,
      date: "2026-10-05",
    });
    const keys = schedule.times.map((time) => time.labelKey);
    expect(new Set(keys).size).toBe(PRAYER_IDS.length);
    for (const id of PRAYER_IDS as readonly PrayerId[]) {
      expect(prayerTime(schedule, id)?.labelKey).toContain(id);
    }
  });
});
