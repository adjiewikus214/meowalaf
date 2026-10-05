/**
 * Owner: core/db. Factory pembuka repo progres — satu-satunya titik yang tahu
 * storage mana yang dipakai (ARCHITECTURE.md § 4.3: hanya repo yang menyentuh DB).
 *
 * Kenapa modul ini serumit ini: di web, OPFS hanya mengizinkan SATU `SyncAccessHandle`
 * terbuka per file untuk satu origin. wa-sqlite memegang handle itu selama tab hidup,
 * jadi tab kedua yang membuka `ayatin.db` akan kena
 * `NoModificationAllowedError: createSyncAccessHandle`. Versi pertama skrip ini
 * menambah satu baris `catch` → fallback in-memory DIAM-DIAM, dan user baru
 * sadar setelah progresnya hilang.
 *
 * Tiga lapis solving:
 *   1. `navigator.locks` (Web Locks API) sebagai election penulis tunggal. Ini
 *      primitive yang benar untuk lintas tab: otomatis lepas saat tab ditutup,
 *      jadi tidak ada lock yatim dan tidak ada heartbeat yang bisa bocor.
 *   2. Retry dengan backoff singkat setelah lock didapat — handle milik tab lama
 *      kadang baru dilepas setelah satu putaran event loop.
 *   3. Kalau lock memang tidak dalam batas waktu, JANGAN diam-diam: status
 *      jadi "memory" + banner di UI, dan tab ini tetap mencoba naik ke SQLite
 *      di belakang layar,sambil memindahkan data yang sudah tercatat di memori.
 *
 * Native tidak terpengaruh: navigator.locks tidak ada, jadi blok ini dilewati dan SQLite
 * dibuka seperti biasa.
 */
import { InMemoryProgressRepo, SqliteProgressRepo, type ProgressRepo, type SqliteDb } from "./progress-repo";
import { setStatus } from "./storage-status";

/** Nama file DB progres — satu-satunya sumber kebenaran nama file SQLite. */
const DB_NAME = "ayatin.db";

/**
 * Nama lock penulis. Harus sama persis antar tab; salah ketik di sini di sini membuat
 * dua tab sama-sama merasa berhak menulis (dan corruption datang diam-diam).
 */
export const WRITER_LOCK_NAME = "ayatin-sqlite-writer";

/** Berapa lama tab menunggu tab lain melepas lock sebelum turun ke in-memory. */
export const LOCK_WAIT_MS = 8000;

/** Backoff percobaan buka ulang setelah lock didapat (ms). */
export const OPEN_RETRY_DELAYS = [120, 400, 1000] as const;

/** Pesan yang dibaca manusia saat progres tidak bisa disimpan. */
export const MEMORY_REASON_LOCKED = "Ada tab Meowalaf lain yang lagi buka aplikasi ini.";
export const MEMORY_REASON_BROKEN = "Penyimpanan browser belum bisa dipakai.";

/** Bentuk minimal Web Locks yang dipakai — biar bisa di-stub di test. */
type LockManagerLike = {
  request: (
    name: string,
    options: { mode: "exclusive"; ifAvailable?: boolean; signal?: AbortSignal },
    callback: () => Promise<void>,
  ) => Promise<void>;
};

function lockManager(): LockManagerLike | null {
  const nav = globalThis.navigator as Navigator & { locks?: LockManagerLike } | undefined;
  return nav?.locks ?? null;
}

/**
 * Error "file sedang dipakai tab lain" vs error lain. Klasifikasi ini yang
 * menentukan apakah kita menunggu, mencoba lagi, atau langsung menyerah.
 */
export function isLockConflict(error: unknown): boolean {
  const text =
    error instanceof Error ? `${error.name}: ${error.message}` : typeof error === "string" ? error : "";
  return (
    text.includes("NoModificationAllowedError") ||
    text.includes("createSyncAccessHandle") ||
    text.includes("Access Handles cannot be created") ||
    text.includes("NoModificationAllowed")
  );
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ambil lock penulis tunggal.
 * - Tidak ada Web Locks (native, atau browser tua) → dianggap berhasil; SQLite
 *   di sana tidak punya aturan satu-tab seperti OPFS.
 * - Lock dipakai dalam batas waktu → "timeout".
 * - Lock berhasil → "acquired", `release` dipakai untuk melepas (biasanya
 *   tidak perlu: browser melepas sendiri saat tab ditutup).
 */
/**
 * `announce` = true saat ini percobaan PEMBUKAAN (UI harus tahu kita menunggu).
 * Upgrade latar belakang memakai announce=false: kalau tidak, setiap percobaan
 * tiap 5 detik akan menulis ulang status jadi "waiting" dan banner berkedip
 * di antara dua kondisi — user lihat kedipan, bukan informasi.
 */
export async function acquireWriterLock(
  waitMs: number = LOCK_WAIT_MS,
  announce = true,
): Promise<{
  outcome: "acquired" | "timeout" | "unsupported";
  release: () => void;
}> {
  const locks = lockManager();
  if (locks === null) return { outcome: "unsupported", release: () => undefined };

  // Ada kemungkinan tab lain yang memegang DB: UI harus tahu kita SEDANG
  // menunggu, bukan diam saja sampai splash lepas.
  if (announce) setStatus({ phase: "waiting" });

  let release = (): void => undefined;
  let settled = false;
  // PENTING: kalau kita menyerah menunggu, request yang masih/antre HARUS
  // dibatalkan. Kalau tidak, request itu akan tetap menggantung dan begitu tab
  // lain tutup, lock justru jatuh ke tab ini — yang sedang memakai repo
  // in-memory.Artinya tab ini mengunci dirinya sendiri tanpa pernah naik ke
  // SQLite, dan setiap percobaan upgrade berikutnya antre di belakang lock
  // miliknya sendiri.
  const controller = new AbortController();
  const granted = new Promise<void>((resolve) => {
    // Lock ditahan selama tab hidup (lihat releaseUntilUnload di bawah).
    locks
      .request(
        WRITER_LOCK_NAME,
        { mode: "exclusive", signal: controller.signal },
        async () => {
          settled = true;
          resolve();
          // Tahan sampai halaman ditutup: browser otomatis melepas lock ini.
          await new Promise<void>((done) => {
            release = () => done();
          });
        },
      )
      .catch(() => {
        if (!settled) resolve();
      });
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), waitMs);
  });

  const first = await Promise.race([granted.then(() => "acquired" as const), timeout]);
  if (timer !== undefined) clearTimeout(timer);
  if (first === "timeout") controller.abort(); // jangan tinggalkan request menggantung
  if (first === "acquired") {
    const releaseOnce = () => {
      release();
    };
    if (typeof globalThis.addEventListener === "function") {
      globalThis.addEventListener("pagehide", releaseOnce, { once: true });
    }
    return { outcome: "acquired", release: releaseOnce };
  }
  return { outcome: "timeout", release: () => undefined };
}

/** Buka SQLite + migrasi, dengan retry singkat untuk handle yang baru dilepas. */
async function openSqliteWithRetry(
  sqlite: typeof import("expo-sqlite"),
  sleepFn: (ms: number) => Promise<void>,
  onAttempt: (attempt: number) => void,
): Promise<SqliteProgressRepo> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= OPEN_RETRY_DELAYS.length; attempt += 1) {
    const delay = attempt === 0 ? 0 : OPEN_RETRY_DELAYS[attempt - 1]!;
    if (delay > 0) await sleepFn(delay);
    onAttempt(attempt);
    try {
      const db = await sqlite.openDatabaseAsync(DB_NAME);
      const repo = new SqliteProgressRepo(db as unknown as SqliteDb);
      await repo.migrate();
      return repo;
    } catch (error) {
      lastError = error;
      // Hanya bentrok lock yang layak diulang; error lain (kode migrasi rusak,
      // WASM gagal load) bakal gagal lagi dengan pesan yang sama.
      if (!isLockConflict(error)) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export type OpenRepoOptions = {
  /** Berapa lama menunggu lock sebelum turun ke in-memory. */
  lockWaitMs?: number;
  /** Injeksi sleep — dipakai test supaya retry tidak slowed down beneran. */
  sleep?: (ms: number) => Promise<void>;
};

export type OpenProgressResult = {
  /** Repo yang harus dipakai app sekarang. */
  repo: ProgressRepo;
  /**
   * Repo in-memory yang sedang jadi tempat sementara (null kalau SQLite berhasil
   * atau tidak ada Web Locks). Kalau ada, pemanggil boleh mencoba upgrade.
   */
  pending: InMemoryProgressRepo | null;
};

/**
 * Buka penyimpanan progres. Tidak pernah melempar: kalau SQLite benar-benar tidak
 * mungkin, turun ke in-memory — tapi statusnya jadi "memory" supaya UI
 * bisa memberi tahu, bukan diam-diam.
 */
export async function openProgressRepo(options: OpenRepoOptions = {}): Promise<OpenProgressResult> {
  const lockWaitMs = options.lockWaitMs ?? LOCK_WAIT_MS;
  const nap = options.sleep ?? sleep;
  setStatus({ phase: "opening", reason: null, otherTab: false, attempts: 0 });
  const lock = await acquireWriterLock(lockWaitMs);

  if (lock.outcome === "acquired" || lock.outcome === "unsupported") {
    try {
      const sqlite = await import("expo-sqlite");
      const repo = await openSqliteWithRetry(sqlite, nap, (attempt) => {
        if (attempt > 0) setStatus({ attempts: attempt });
      });
      setStatus({ phase: "sqlite", reason: null, otherTab: false, attempts: 0 });
      return { repo, pending: null };
    } catch (error) {
      console.warn("[db] SQLite gagal dibuka:", error);
      setStatus({
        phase: "memory",
        otherTab: isLockConflict(error),
        reason: isLockConflict(error) ? MEMORY_REASON_LOCKED : MEMORY_REASON_BROKEN,
      });
      const fallback = new InMemoryProgressRepo();
      await fallback.migrate();
      return { repo: fallback, pending: fallback };
    }
  }

  // Lock ditahan sampai batas waktu → tunggu status, lalu in-memory.
  setStatus({
    phase: "memory",
    otherTab: true,
    reason: MEMORY_REASON_LOCKED,
  });
  const fallback = new InMemoryProgressRepo();
  await fallback.migrate();
  return { repo: fallback, pending: fallback };
}

export type UpgradeResult = {
  repo: SqliteProgressRepo;
  carriedLessons: number;
  carriedBonus: number;
} | null;

/**
 * Coba naik ke SQLite setelah tab lain melepas lock, sambil MEMINDAHKAN apa yang
 * sudah tercatat di repo in-memory. Tanpa pemindahan ini, lesson yang dikerjakan
 * selama tab kedua menunggu akan hilang diam-diam saat pindah — persis masalah
 * yang sedang kita perbaiki.
 */
export async function upgradeToSqlite(
  pending: InMemoryProgressRepo,
  options: OpenRepoOptions = {},
): Promise<UpgradeResult> {
  const nap = options.sleep ?? sleep;
  // announce=false: ini percobaan latar, bukan pembukaan — status yang
  // tampil harus tetap "memory" selama tab lain masih memegang DB.
  const lock = await acquireWriterLock(options.lockWaitMs ?? 2000, false);
  if (lock.outcome === "timeout") return null;

  try {
    const sqlite = await import("expo-sqlite");
    const repo = await openSqliteWithRetry(sqlite, nap, () => undefined);
    const lessons = await pending.getAllLessons();
    const bonus = await pending.getAllBonusXp();

    for (const lesson of lessons) await repo.recordLessonSession(lesson);
    for (const entry of bonus) await repo.recordBonusXp(entry);
    // Snapshot harian terakhir: tanpa ini streak/lessonsToday pada hari yang
    // sama akan dihitung ulang dari nol padahal user sudah ngaji.
    for (const row of [...pending.progressDays.values()]) await repo.saveProgressDay(row);

    setStatus({ phase: "sqlite", reason: null, otherTab: false, attempts: 0 });
    return { repo, carriedLessons: lessons.length, carriedBonus: bonus.length };
  } catch (error) {
    console.warn("[db] naik ke SQLite gagal:", error);
    return null;
  }
}

/** Diekspor untuk test/komposisi manual (mis. preset dev tanpa DB). */
export { InMemoryProgressRepo, SqliteProgressRepo, type SqliteDb };
