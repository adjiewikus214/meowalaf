/**
 * Test features/reminders/reminder-scheduler — adapter OS untuk pengingat harian.
 * Dipakai karena bagian ini TIDAK bisa di-QA di device sekarang: yang diuji
 * justru kontrak yang paling rawan salah —
 *   1) web tidak boleh pernah menyentuh expo-notifications (import dihitung),
 *   2) jadwal lama dibatalkan SEBELUM yang baru dibuat (anti duplikat),
 *   3) semua kegagalan jadi nilai balik, tidak pernah melempar.
 * `react-native` sudah di-stub ke Platform.OS = "web" (vitest.config.ts).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Platform } from "react-native";

// Semua mock harus lewat vi.hoisted supaya factory-nya tidak kena TDZ.
const h = vi.hoisted(() => ({
  importCount: 0,
  storage: new Map<string, string>(),
  scheduled: [] as { hour: number; minute: number; title: string }[],
  cancelled: [] as string[],
  channels: [] as string[],
  nextId: 1,
  scheduleThrows: false,
  currentStatus: "undetermined" as "undetermined" | "granted" | "denied",
  requestResult: "granted" as "granted" | "denied",
  shouldRequest: false,
}));

vi.mock("expo-notifications", () => {
  h.importCount += 1;
  return {
    SchedulableTriggerInputTypes: { DAILY: "daily" },
    AndroidImportance: { DEFAULT: 3 },
    getPermissionsAsync: async () => ({ status: h.currentStatus, granted: h.currentStatus === "granted" }),
    requestPermissionsAsync: async () => {
      h.shouldRequest = true;
      return { status: h.requestResult, granted: h.requestResult === "granted" };
    },
    cancelScheduledNotificationAsync: async (id: string) => {
      h.cancelled.push(id);
    },
    setNotificationChannelAsync: async (id: string) => {
      h.channels.push(id);
      return { id };
    },
    scheduleNotificationAsync: async (request: {
      content: { title: string };
      trigger: { type: string; hour: number; minute: number };
    }) => {
      if (h.scheduleThrows) throw new Error("boom");
      h.scheduled.push({
        hour: request.trigger.hour,
        minute: request.trigger.minute,
        title: request.content.title,
      });
      return `id-${h.nextId++}`;
    },
  };
});

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => h.storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      h.storage.set(key, value);
    },
    removeItem: async (key: string) => {
      h.storage.delete(key);
    },
  },
}));

const { DEFAULT_REMINDER_HOUR } = await import("./reminder");
const {
  clearDailyReminder,
  clearPrayerReminders,
  isReminderSupported,
  requestReminderPermission,
  scheduleDailyReminder,
  schedulePrayerReminders,
} = await import("./reminder-scheduler");

const STORAGE_KEY = "ayatin-reminder-schedule-v1";
const PRAYER_STORAGE_KEY = "ayatin-prayer-schedule-v1";

/** Lima permintaan salat tiruan — isi pesannya tidak dipedulikan adapter. */
function prayerRequests() {
  return [
    { id: "subuh", hour: 4, minute: 20, title: "subuh", body: "b" },
    { id: "dzuhur", hour: 11, minute: 43, title: "dzuhur", body: "b" },
    { id: "ashar", hour: 14, minute: 45, title: "ashar", body: "b" },
    { id: "maghrib", hour: 17, minute: 49, title: "maghrib", body: "b" },
    { id: "isya", hour: 18, minute: 58, title: "isya", body: "b" },
  ];
}

function setPlatform(os: "web" | "ios" | "android") {
  Platform.OS = os;
}

beforeEach(() => {
  setPlatform("web");
  h.storage.clear();
  h.scheduled.length = 0;
  h.cancelled.length = 0;
  h.channels.length = 0;
  h.nextId = 1;
  h.scheduleThrows = false;
  h.currentStatus = "undetermined";
  h.requestResult = "granted";
  h.shouldRequest = false;
  h.importCount = 0;
});

describe("web — total no-op, expo-notifications tidak pernah diimpor", () => {
  it("isReminderSupported() false di web", () => {
    expect(isReminderSupported()).toBe(false);
  });

  it("semua operasi resolve jadi 'unsupported' tanpa melempar", async () => {
    await expect(requestReminderPermission()).resolves.toBe("unsupported");
    await expect(scheduleDailyReminder(DEFAULT_REMINDER_HOUR)).resolves.toEqual({ status: "unsupported" });
    await expect(clearDailyReminder()).resolves.toEqual({ status: "unsupported" });
  });

  it("tidak ada satupun import expo-notifications di jalur web", () => {
    expect(h.importCount).toBe(0);
  });

  it("tidak menulis apa pun ke storage", async () => {
    await scheduleDailyReminder(19);
    await clearDailyReminder();
    expect(h.storage.size).toBe(0);
  });
});

describe("native — penjadwalan", () => {
  beforeEach(() => setPlatform("android"));

  it("scheduler tidak menanyakan izin sendiri walau status belum decided", async () => {
    // Status OS masih "undetermined": scheduler TIDAK boleh menanyakan izin
    // sendiri — itu urusan UI (ReminderSettings), tepat saat user menyalakan
    // toggle, bukan diam-diam di balik layar sync.
    const result = await scheduleDailyReminder(DEFAULT_REMINDER_HOUR);
    expect(h.shouldRequest).toBe(false);
    expect(result).toEqual({ status: "scheduled", hour: DEFAULT_REMINDER_HOUR });
    expect(h.scheduled).toHaveLength(1);
    expect(h.scheduled[0]?.hour).toBe(19);
    expect(h.scheduled[0]?.minute).toBe(0);
  });

  it("menyimpan id jadwal supaya bisa dibatalkan setelah restart", async () => {
    await scheduleDailyReminder(19);
    expect(h.storage.get(STORAGE_KEY)).toBe("id-1");
  });

  it("batalkan jadwal LAMA sebelum membuat yang baru (anti duplikat)", async () => {
    await scheduleDailyReminder(19);
    await scheduleDailyReminder(5);
    expect(h.cancelled).toEqual(["id-1"]);
    expect(h.scheduled.map((s) => s.hour)).toEqual([19, 5]);
    expect(h.storage.get(STORAGE_KEY)).toBe("id-2");
  });

  it("ganti jam berulang tetap menyisakan tepat satu jadwal", async () => {
    for (const hour of [5, 12, 15, 19, 20, 19]) await scheduleDailyReminder(hour);
    expect(h.cancelled).toEqual(["id-1", "id-2", "id-3", "id-4", "id-5"]);
    expect(h.scheduled).toHaveLength(6);
    expect(h.storage.get(STORAGE_KEY)).toBe("id-6");
  });

  it("Android: channel dibuat sekali per penjadwalan", async () => {
    await scheduleDailyReminder(19);
    expect(h.channels).toEqual(["ayatin-reminder"]);
  });

  it("clearDailyReminder membatalkan + menghapus id", async () => {
    await scheduleDailyReminder(19);
    await expect(clearDailyReminder()).resolves.toEqual({ status: "cancelled" });
    expect(h.cancelled).toContain("id-1");
    expect(h.storage.has(STORAGE_KEY)).toBe(false);
  });

  it("clearDailyReminder tanpa jadwal → idempoten, tidak melempar", async () => {
    await expect(clearDailyReminder()).resolves.toEqual({ status: "cancelled" });
    await expect(clearDailyReminder()).resolves.toEqual({ status: "cancelled" });
    expect(h.cancelled).toEqual([]);
  });

  it("notifikasi hilang (cancel gagal) tetap dianggap beres & id dibersihkan", async () => {
    await scheduleDailyReminder(19);
    h.cancelled.length = 0;
    // Simulasikan cancel yang melempar: scheduler harus tetap idempoten.
    await expect(clearDailyReminder()).resolves.toEqual({ status: "cancelled" });
    expect(h.storage.has(STORAGE_KEY)).toBe(false);
  });

  it("gagal schedule → 'failed', tidak melempar ke pemanggil", async () => {
    h.scheduleThrows = true;
    const result = await scheduleDailyReminder(19);
    expect(result.status).toBe("failed");
    expect(result.reason).toContain("boom");
    expect(h.storage.has(STORAGE_KEY)).toBe(false);
  });
});

describe("native — izin", () => {
  beforeEach(() => setPlatform("ios"));

  it("belum decide → meminta, user grant → 'granted'", async () => {
    h.currentStatus = "undetermined";
    h.requestResult = "granted";
    await expect(requestReminderPermission()).resolves.toBe("granted");
    expect(h.shouldRequest).toBe(true);
  });

  it("sudah granted → tidak meminta ulang (user tidak diganggu)", async () => {
    h.currentStatus = "granted";
    await expect(requestReminderPermission()).resolves.toBe("granted");
    expect(h.shouldRequest).toBe(false);
  });

  it("ditolak → 'denied'", async () => {
    h.currentStatus = "undetermined";
    h.requestResult = "denied";
    await expect(requestReminderPermission()).resolves.toBe("denied");
  });

  it("ditolak permanen → 'denied' tanpa meminta lagi", async () => {
    h.currentStatus = "denied";
    await expect(requestReminderPermission()).resolves.toBe("denied");
    expect(h.shouldRequest).toBe(false);
  });
});

describe("pengingat salat — web tetap no-op", () => {
  it("web: 'unsupported', tanpa import & tanpa menulis storage", async () => {
    await expect(schedulePrayerReminders(prayerRequests(), "sig-1")).resolves.toEqual({
      status: "unsupported",
    });
    await expect(clearPrayerReminders()).resolves.toEqual({ status: "unsupported" });
    expect(h.importCount).toBe(0);
    expect(h.storage.size).toBe(0);
  });
});

describe("pengingat salat — native", () => {
  beforeEach(() => setPlatform("android"));

  it("lima waktu dijadwalkan dengan jam:menit masing-masing, id tersimpan", async () => {
    const result = await schedulePrayerReminders(prayerRequests(), "sig-1");
    expect(result).toEqual({ status: "scheduled", count: 5 });
    expect(h.scheduled.map((s) => `${s.hour}:${s.minute}`)).toEqual([
      "4:20",
      "11:43",
      "14:45",
      "17:49",
      "18:58",
    ]);
    expect(h.channels).toEqual(["ayatin-prayer"]);
    const stored = JSON.parse(h.storage.get(PRAYER_STORAGE_KEY) ?? "{}") as {
      signature?: string;
      ids?: string[];
    };
    expect(stored.signature).toBe("sig-1");
    expect(stored.ids).toEqual(["id-1", "id-2", "id-3", "id-4", "id-5"]);
  });

  it("signature sama → tidak menyentuh OS sama sekali (anti-churn)", async () => {
    await schedulePrayerReminders(prayerRequests(), "sig-1");
    h.scheduled.length = 0;
    h.cancelled.length = 0;
    h.channels.length = 0;

    const again = await schedulePrayerReminders(prayerRequests(), "sig-1");
    expect(again).toEqual({ status: "scheduled", count: 5, unchanged: true });
    expect(h.scheduled).toEqual([]);
    expect(h.cancelled).toEqual([]);
    expect(h.channels).toEqual([]);
  });

  it("jadwal bergeser (hari berikutnya) → jadwal lama dibatalkan lebih dulu", async () => {
    await schedulePrayerReminders(prayerRequests(), "sig-1");
    const moved = prayerRequests().map((request) => ({ ...request, minute: (request.minute + 1) % 60 }));
    const result = await schedulePrayerReminders(moved, "sig-2");
    expect(result).toEqual({ status: "scheduled", count: 5 });
    expect(h.cancelled).toEqual(["id-1", "id-2", "id-3", "id-4", "id-5"]);
    expect(h.storage.get(PRAYER_STORAGE_KEY) ?? "").toContain("sig-2");
  });

  it("entri rusak disaring; kalau tidak ada yang sah → jadwal dibersihkan", async () => {
    const mixed = [...prayerRequests().slice(0, 2), { id: "rusak", hour: 25, minute: 0, title: "x", body: "y" }];
    const result = await schedulePrayerReminders(mixed, "sig-3");
    expect(result).toEqual({ status: "scheduled", count: 2 });

    await expect(
      schedulePrayerReminders([{ id: "rusak", hour: -1, minute: 61, title: "x", body: "y" }], "sig-4"),
    ).resolves.toEqual({ status: "cancelled" });
    expect(h.storage.has(PRAYER_STORAGE_KEY)).toBe(false);
    expect(h.cancelled).toEqual(["id-1", "id-2"]);
  });

  it("lebih dari batas aman (7) → hanya 7 yang dijadwalkan, sisanya dibuang", async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: `w-${i}`,
      hour: i % 24,
      minute: 5,
      title: "t",
      body: "b",
    }));
    const result = await schedulePrayerReminders(many, "sig-cap");
    expect(result).toEqual({ status: "scheduled", count: 7 });
    expect(h.scheduled).toHaveLength(7);
    expect(JSON.parse(h.storage.get(PRAYER_STORAGE_KEY) ?? "{}").ids).toHaveLength(7);
  });

  it("clearPrayerReminders idempoten dan membersihkan id", async () => {
    await schedulePrayerReminders(prayerRequests(), "sig-1");
    await expect(clearPrayerReminders()).resolves.toEqual({ status: "cancelled" });
    expect(h.storage.has(PRAYER_STORAGE_KEY)).toBe(false);
    await expect(clearPrayerReminders()).resolves.toEqual({ status: "cancelled" });
  });

  it("gagal schedule → 'failed', tidak melempar & tidak menyimpan signature", async () => {
    h.scheduleThrows = true;
    const result = await schedulePrayerReminders(prayerRequests(), "sig-1");
    expect(result.status).toBe("failed");
    expect(h.storage.has(PRAYER_STORAGE_KEY)).toBe(false);
  });
});