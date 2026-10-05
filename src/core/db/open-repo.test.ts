/**
 * Test core/db/open-repo — Mechanism dua tab di web.
 *
 * Bagian ini mustahil diuji manual (butuh dua tab browser + OPFS), jadi yang
 * diuji justru kontrak yang paling rawan salah:
 *   1) error bentrok lock vs error lain dibeda dengan benar (menunggu vs menyerah),
 *   2) lock yang tidak pernah datang tidak menggantung selamanya,
 *   3) naik ke SQLite MEMINDAHKAN data yang sudah tercatat di memori — kalau
 *      ini hilang, perbaikan "tahan dua tab" justru/delete progres user.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { InMemoryProgressRepo } from "./progress-repo";
import {
  LOCK_WAIT_MS,
  MEMORY_REASON_LOCKED,
  WRITER_LOCK_NAME,
  acquireWriterLock,
  isLockConflict,
  openProgressRepo,
  upgradeToSqlite,
} from "./open-repo";
import { getStorageStatus, resetStatus, setStatus } from "./storage-status";

/** Repo SQLite palsu: hanya mencatat apa yang ditulis, supaya carry-over bisa dicek. */
const calls = vi.hoisted(() => ({
  lessons: [] as string[],
  bonus: [] as string[],
  progressDays: [] as string[],
  openCount: 0,
  /** Kalau diisi, openDatabaseAsync akan meledak dengan error ini. */
  openError: null as Error | null,
}));

vi.mock("./progress-repo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./progress-repo")>();
  class FakeSqliteRepo {
    async migrate(): Promise<void> {
      return undefined;
    }
    async recordLessonSession(record: { id: string }): Promise<"saved"> {
      calls.lessons.push(record.id);
      return "saved";
    }
    async recordBonusXp(entry: { id: string }): Promise<void> {
      calls.bonus.push(entry.id);
    }
    async saveProgressDay(row: { day: string }): Promise<void> {
      calls.progressDays.push(row.day);
    }
  }
  return { ...actual, SqliteProgressRepo: FakeSqliteRepo };
});

vi.mock("expo-sqlite", () => ({
  openDatabaseAsync: async () => {
    calls.openCount += 1;
    if (calls.openError !== null) throw calls.openError;
    return {};
  },
}));

type StubLock = { request: unknown };

function setLocks(impl: StubLock | null): void {
  Object.defineProperty(globalThis, "navigator", {
    value: impl === null ? undefined : { locks: impl },
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  setLocks(null);
  resetStatus();
  calls.lessons = [];
  calls.bonus = [];
  calls.progressDays = [];
  calls.openCount = 0;
  calls.openError = null;
});

describe("isLockConflict", () => {
  it("kenali error OPFS yang khas: sync access handle sedang dipakai", () => {
    const real = new Error(
      "Failed to execute 'createSyncAccessHandle' on 'FileSystemFileHandle': Access Handles cannot be created if there is another open Access Handle",
    );
    real.name = "NoModificationAllowedError";
    expect(isLockConflict(real)).toBe(true);
    expect(isLockConflict("NoModificationAllowedError")).toBe(true);
    expect(isLockConflict(new Error("Access Handles cannot be created"))).toBe(true);
  });

  it("error lain TIDAK dianggap bentrok lock (cuma sekali coba, jangan Delay sia-sia)", () => {
    expect(isLockConflict(new Error("SQL logic error: near CREATE"))).toBe(false);
    expect(isLockConflict(new Error("wasm compile failed"))).toBe(false);
    expect(isLockConflict(undefined)).toBe(false);
  });
});

describe("acquireWriterLock", () => {
  it("tanpa Web Locks (native / browser tua) → unsupported, SQLite tetap dibuka", async () => {
    setLocks(null);
    await expect(acquireWriterLock(50)).resolves.toMatchObject({ outcome: "unsupported" });
  });

  it("lock diberikan → acquired, dan status jadi waiting selama menunggu", async () => {
    let held = false;
    setLocks({
      request: async (_name: string, _options: unknown, callback: () => Promise<void>) => {
        held = true;
        await callback();
      },
    });
    const lock = await acquireWriterLock(200);
    expect(lock.outcome).toBe("acquired");
    expect(held).toBe(true);
    // Status "waiting" diset saat meminta lock; status final disliked caller.
    expect(getStorageStatus().phase).toBe("waiting");
  });

  it("lock tidak pernah datang → timeout, bukan hanging", async () => {
    setLocks({ request: () => new Promise<void>(() => undefined) });
    const started = Date.now();
    const lock = await acquireWriterLock(120);
    expect(lock.outcome).toBe("timeout");
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("saat menyerah, request lock yang menggantung DIBATALKAN (bug QA: tab kunci dirinya sendiri)", async () => {
    // Tanpa abort, request yang timeout tetap menggantung; begitu tab lain tutup,
    // lock jatuh ke tab ini yang justru sedang memakai in-memory, dan semua
    // percobaan upgrade berikutnya antre di belakang lock miliknya sendiri.
    // Pakai holder object: TypeScript tidak melihat assignment di dalam callback.
    const captured: { signal: AbortSignal | null } = { signal: null };
    setLocks({
      request: async (_name: string, options: { signal?: AbortSignal }) => {
        captured.signal = options.signal ?? null;
        return new Promise<void>(() => undefined);
      },
    });
    const lock = await acquireWriterLock(60);
    expect(lock.outcome).toBe("timeout");
    expect(captured.signal).not.toBeNull();
    expect((captured.signal as AbortSignal).aborted).toBe(true);
  });

  it("nama lock konsisten antar tab (kalau berubah, dua tab sama-sama menulis)", () => {
    expect(WRITER_LOCK_NAME).toBe("ayatin-sqlite-writer");
    expect(LOCK_WAIT_MS).toBeGreaterThan(0);
  });
});

describe("openProgressRepo", () => {
  it("SQLite bisa dibuka → phase sqlite, tidak ada repo tertunda", async () => {
    setLocks(null);
    const result = await openProgressRepo({ lockWaitMs: 80 });
    expect(getStorageStatus().phase).toBe("sqlite");
    expect(result.pending).toBeNull();
    expect(result.repo).not.toBeInstanceOf(InMemoryProgressRepo);
  });

  it("lock ditahan tab lain → turun ke in-memory TAPI status-nya menandai tab lain + pending untuk upgrade", async () => {
    setLocks({ request: () => new Promise<void>(() => undefined) });
    const result = await openProgressRepo({ lockWaitMs: 80 });
    const status = getStorageStatus();
    expect(status.phase).toBe("memory");
    expect(status.otherTab).toBe(true);
    expect(status.reason).toBe(MEMORY_REASON_LOCKED);
    expect(result.pending).toBeInstanceOf(InMemoryProgressRepo);
    expect(result.repo).toBe(result.pending);
  });

  it("SQLite rusak (bukan lock) → in-memory dengan alasan yang berbeda, bukan 'tab lain'", async () => {
    setLocks(null);
    calls.openError = new Error("wasm compile failed");
    await openProgressRepo({ lockWaitMs: 80 });
    const status = getStorageStatus();
    expect(status.phase).toBe("memory");
    expect(status.otherTab).toBe(false);
    expect(calls.openCount).toBe(1); // error non-lock tidak diulang
  });

});

describe("upgradeToSqlite (naik dari in-memory)", () => {
  it("memindahkan lesson, bonus XP, dan snapshot harian ke SQLite", async () => {
    setLocks(null);
    const pending = new InMemoryProgressRepo();
    await pending.migrate();
    await pending.recordLessonSession({
      id: "lesson-a",
      day: "2026-10-03",
      surahId: 1,
      unitIndex: 0,
      xpEarned: 25,
      accuracy: 1,
      perfect: true,
      events: [],
      createdAt: "2026-10-03T04:00:00.000Z",
    } as never);
    await pending.recordBonusXp({
      id: "bonus-1",
      day: "2026-10-03",
      amount: 15,
      reason: "achievement:perfect",
      createdAt: "2026-10-03T04:00:01.000Z",
    });
    pending.progressDays.set("2026-10-03", {
      day: "2026-10-03",
      xpTotal: 40,
      streakCount: 1,
      lastActiveDay: "2026-10-03",
      freezeAvailable: true,
      freezeUsedDay: null,
      lessonsToday: 1,
      correctToday: 6,
    });

    const up = await upgradeToSqlite(pending, { lockWaitMs: 80 });
    expect(up).not.toBeNull();
    expect(up?.carriedLessons).toBe(1);
    expect(up?.carriedBonus).toBe(1);
    expect(calls.lessons).toContain("lesson-a");
    expect(calls.bonus).toContain("bonus-1");
    expect(calls.progressDays).toContain("2026-10-03");
    expect(getStorageStatus().phase).toBe("sqlite");
  });

  it("lock masih ditahan → null, data di memori TIDAK dibuang", async () => {
    const pending = new InMemoryProgressRepo();
    await pending.recordLessonSession({
      id: "lesson-b",
      day: "2026-10-03",
      surahId: 1,
      unitIndex: 0,
      xpEarned: 10,
      accuracy: 1,
      perfect: false,
      events: [],
      createdAt: "2026-10-03T04:00:00.000Z",
    } as never);

    setLocks({ request: () => new Promise<void>(() => undefined) });
    const up = await upgradeToSqlite(pending, { lockWaitMs: 80 });
    expect(up).toBeNull();
    expect(await pending.getAllLessons()).toHaveLength(1);
    expect(getStorageStatus().phase).not.toBe("sqlite");
  });

  it("status yang sebelumnya 'memory' tidak diubah kalau upgrade gagal", async () => {
    setStatus({ phase: "memory", reason: MEMORY_REASON_LOCKED, otherTab: true });
    setLocks(null);
    calls.openError = new Error("SQLITE_CANTOPEN: database disk image is malformed");
    const pending = new InMemoryProgressRepo();
    const up = await upgradeToSqlite(pending, { lockWaitMs: 80 });
    expect(up).toBeNull();
    const status = getStorageStatus();
    expect(status.phase).toBe("memory");
    expect(status.otherTab).toBe(true);
  });
});
