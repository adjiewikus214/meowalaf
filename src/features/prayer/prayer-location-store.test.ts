/**
 * Test features/prayer/prayer-location-store — store ini menentukan jadwal mana
 * yang dihitung & notifikasi apa yang dijadwalkan, dan tidak ada UI yang bisa
 * membuktikannya di CI. Yang dijaga: id kota tak dikenal tidak pernah tersimpan,
 * jalur GPS selalu bisa dibalik ke kota manual, dan yang dipersist hanya data
 * mentah (bukan fungsi).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  writes: [] as { key: string; value: string }[],
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => h.storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      h.storage.set(key, value);
      h.writes.push({ key, value });
    },
    removeItem: async (key: string) => {
      h.storage.delete(key);
    },
  },
}));

const { usePrayerLocationStore } = await import("./prayer-location-store");

beforeEach(() => {
  h.storage.clear();
  h.writes.length = 0;
  usePrayerLocationStore.getState().resetAll();
});

describe("default", () => {
  it("mulai dari kota default, jalur kota, notifikasi mati", () => {
    const state = usePrayerLocationStore.getState();
    expect(state.cityId).toBe("jakarta");
    expect(state.source).toBe("city");
    expect(state.gps).toBeNull();
    expect(state.notificationsEnabled).toBe(false);
  });
});

describe("pilih kota", () => {
  it("mengganti kota sekaligus memakai jalur kota manual", () => {
    usePrayerLocationStore.getState().useGpsFix({ lat: -5.1, lng: 119.45, accuracyM: 8, at: 1 });
    expect(usePrayerLocationStore.getState().source).toBe("gps");

    usePrayerLocationStore.getState().setCity("bandung");
    const state = usePrayerLocationStore.getState();
    expect(state.cityId).toBe("bandung");
    expect(state.source).toBe("city");
    // Fix lama dibiarkan tersimpan; hanya sumbernya yang berpindah.
    expect(state.gps?.lat).toBeCloseTo(-5.1, 4);
  });

  it("id tak dikenal diabaikan, bukan disimpan", () => {
    usePrayerLocationStore.getState().setCity("atlantis");
    expect(usePrayerLocationStore.getState().cityId).toBe("jakarta");
  });
});

describe("jalur GPS & toggle notifikasi", () => {
  it("fix GPS dipakai apa adanya", () => {
    usePrayerLocationStore.getState().useGpsFix({ lat: -6.9175, lng: 107.6191, accuracyM: 12, at: 42 });
    const state = usePrayerLocationStore.getState();
    expect(state.source).toBe("gps");
    expect(state.gps).toEqual({ lat: -6.9175, lng: 107.6191, accuracyM: 12, at: 42 });
  });

  it("toggle notifikasi hanya menyimpan pilihan", () => {
    usePrayerLocationStore.getState().setNotificationsEnabled(true);
    expect(usePrayerLocationStore.getState().notificationsEnabled).toBe(true);
    usePrayerLocationStore.getState().setNotificationsEnabled(false);
    expect(usePrayerLocationStore.getState().notificationsEnabled).toBe(false);
  });
});

describe("persist", () => {
  it("hanya data mentah yang ditulis ke storage", async () => {
    usePrayerLocationStore.getState().setCity("makassar");
    await vi.waitFor(() => expect(h.writes.length).toBeGreaterThan(0));
    const write = h.writes[h.writes.length - 1];
    expect(write?.key).toBe("ayatin-prayer-location-v1");
    const parsed = JSON.parse(write?.value ?? "{}") as { state?: Record<string, unknown> };
    expect(Object.keys(parsed.state ?? {}).sort()).toEqual([
      "cityId",
      "gps",
      "notificationsEnabled",
      "source",
    ]);
  });
});

describe("resetAll (Profil → hapus semua data)", () => {
  it("kembali ke default sepenuhnya", () => {
    const store = usePrayerLocationStore.getState();
    store.setCity("jayapura");
    store.setNotificationsEnabled(true);
    store.resetAll();
    const state = usePrayerLocationStore.getState();
    expect(state.cityId).toBe("jakarta");
    expect(state.source).toBe("city");
    expect(state.gps).toBeNull();
    expect(state.notificationsEnabled).toBe(false);
  });
});
