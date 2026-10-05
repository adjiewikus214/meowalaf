/**
 * Test features/prayer/device-location — kontrak adapter OS yang tidak bisa
 * dijalankan sungguhan di CI:
 *   1) web tidak boleh pernah menyentuh `expo-location` (import dihitung),
 *   2) izin tidak pernah dipaksa kalau sudah pernah ditolak,
 *   3) koordinat rusak / modul melempar → nilai balik, bukan crash.
 * `react-native` sudah di-stub ke Platform.OS = "web" (vitest.config.ts).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Platform } from "react-native";

const h = vi.hoisted(() => ({
  importCount: 0,
  permissionStatus: "undetermined" as "undetermined" | "granted" | "denied",
  requestGranted: true,
  asked: 0,
  coords: { latitude: -6.1754, longitude: 106.8272, accuracy: 12.6 },
  throws: false,
}));

vi.mock("expo-location", () => {
  h.importCount += 1;
  return {
    Accuracy: { Balanced: 3 },
    getForegroundPermissionsAsync: async () => ({
      status: h.permissionStatus,
      granted: h.permissionStatus === "granted",
    }),
    requestForegroundPermissionsAsync: async () => {
      h.asked += 1;
      return { status: h.requestGranted ? "granted" : "denied", granted: h.requestGranted };
    },
    getCurrentPositionAsync: async () => {
      if (h.throws) throw new Error("sensor mati");
      return { coords: h.coords };
    },
  };
});

const { isDeviceLocationSupported, requestDeviceLocation } = await import("./device-location");

function setPlatform(os: "web" | "ios" | "android") {
  Platform.OS = os;
}

beforeEach(() => {
  setPlatform("web");
  h.importCount = 0;
  h.permissionStatus = "undetermined";
  h.requestGranted = true;
  h.asked = 0;
  h.coords = { latitude: -6.1754, longitude: 106.8272, accuracy: 12.6 };
  h.throws = false;
});

describe("web", () => {
  it("tidak didukung & tidak pernah mengimpor expo-location", async () => {
    expect(isDeviceLocationSupported()).toBe(false);
    await expect(requestDeviceLocation()).resolves.toEqual({ status: "unsupported" });
    expect(h.importCount).toBe(0);
    expect(h.asked).toBe(0);
  });
});

describe("native", () => {
  beforeEach(() => setPlatform("android"));

  it("didukung di android/ios", () => {
    expect(isDeviceLocationSupported()).toBe(true);
    setPlatform("ios");
    expect(isDeviceLocationSupported()).toBe(true);
  });

  it("izin belum diputuskan → meminta, lalu mengembalikan koordinat + akurasi bulat", async () => {
    await expect(requestDeviceLocation()).resolves.toEqual({
      status: "granted",
      lat: -6.1754,
      lng: 106.8272,
      accuracyM: 13,
    });
    expect(h.asked).toBe(1);
  });

  it("sudah granted → tidak menanyakan lagi", async () => {
    h.permissionStatus = "granted";
    await expect(requestDeviceLocation()).resolves.toMatchObject({ status: "granted" });
    expect(h.asked).toBe(0);
  });

  it("ditolak → 'denied', tanpa memaksa izin kedua kali", async () => {
    h.permissionStatus = "denied";
    await expect(requestDeviceLocation()).resolves.toEqual({ status: "denied" });
    expect(h.asked).toBe(0);
  });

  it("permintaan izin ditolak user → 'denied'", async () => {
    h.requestGranted = false;
    await expect(requestDeviceLocation()).resolves.toEqual({ status: "denied" });
    expect(h.asked).toBe(1);
  });

  it("koordinat tidak wajar (0,0 dari device yang belum mengunci) → 'failed'", async () => {
    h.coords = { latitude: Number.NaN, longitude: 0, accuracy: 5 };
    await expect(requestDeviceLocation()).resolves.toMatchObject({ status: "failed" });
  });

  it("modul melempar → nilai balik 'failed', tidak meneruskan error", async () => {
    h.throws = true;
    const result = await requestDeviceLocation();
    expect(result.status).toBe("failed");
    expect(result.status === "failed" ? result.reason : "").toContain("sensor mati");
  });

  it("akurasi tidak dilaporkan → null, bukan angka palsu", async () => {
    h.coords = { latitude: -6.2, longitude: 106.8, accuracy: Number.NaN };
    await expect(requestDeviceLocation()).resolves.toMatchObject({ status: "granted", accuracyM: null });
  });
});
