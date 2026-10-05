/**
 * Owner: core/db. Interface repo lapisan progres + implementasi SQLite
 * (expo-sqlite) dan in-memory (unit/integration test, ARCHITECTURE.md § 8).
 * Satu-satunya penulis SQLite adalah repo di core/progress & core/db (§ 4.3).
 * Modul ini data-only: TANPA import features (aturan arah ARCHITECTURE § 3) —
 * event direpresentasikan dengan tipe diskriminatif minimal di bawah.
 */
import { MIGRATIONS, assertMigrationsValid } from "./migrations";

/** Event lesson (bentuk diskriminatif minimal — data-only, tanpa import features). */
export type RepoLessonEvent =
  | { type: "ANSWER_CORRECT"; questionId?: string; kind: string; withHint: boolean; isRetry: boolean }
  | { type: "ANSWER_WRONG"; questionId?: string; kind: string; isRetry: boolean }
  | { type: "HINT_USED"; questionId: string }
  | { type: "SESSION_COMPLETED"; surahId: number; unitIndex: number };

/** Baris harian progress_state — acuan rekonsiliasi XP/streak per hari WIB. */
export type ProgressDayRow = {
  day: string;
  xpTotal: number;
  streakCount: number;
  lastActiveDay: string | null;
  freezeAvailable: boolean;
  freezeUsedDay: string | null;
  lessonsToday: number;
  correctToday: number;
};

/** Satu sesi lesson selesai yang dicatat append-only (lesson_log + answer_log). */
export type LessonRecord = {
  id: string;
  day: string;
  surahId: number;
  unitIndex: number;
  xpEarned: number;
  accuracy: number;
  perfect: boolean;
  events: readonly RepoLessonEvent[];
  /** ISO timestamp penyelesaian sesi — id log dibentuk darinya (idempoten). */
  completedAt: string;
};

export type SaveOutcome = "saved" | "duplicate";

/**
 * XP di luar lesson (hadiah quest) yang dicatat append-only di xp_ledger.
 * Tidak punya event jawaban, jadi TIDAK bisa direkonstruksi dari lesson_log —
 * Tanpa ledger ini bonus quest hilang tiap app dibuka ulang.
 */
export type BonusXpRecord = {
  id: string;
  day: string;
  amount: number;
  /** Alasan bonus (mis. "quest") — bebas teks pendek, untuk debug/rekap. */
  reason: string;
  createdAt: string;
};

/** Satu ayat yang di-bookmark user. */
export type AyahBookmark = {
  surahId: number;
  ayahNumber: number;
  createdAt: string;
};

/** Interface repo — satu-satunya jalan menuju storage progres (ARCHITECTURE § 4.3). */
export type ProgressRepo = {
  /** Jalankan migrations berurutan (versi sudah diterapkan di-skip). */
  migrate(): Promise<void>;
  /** Baris harian, atau null bila hari itu belum ada aktivitas. */
  getProgressDay(day: string): Promise<ProgressDayRow | null>;
  /** Baris harian TERAKHIR dengan day ≤ `day` — membawa streak/freeze lintas hari. */
  getLatestProgressDayUpTo(day: string): Promise<ProgressDayRow | null>;
  /** Upsert baris harian (snapshot rekonstruksi — bukan log). */
  saveProgressDay(row: ProgressDayRow): Promise<void>;
  /**
   * Catat sesi selesai ATOMIK: lesson_log + answer_log dalam satu transaksi.
   * Idempoten pada lessonId (kill app setelah commit → replays tidak dobel).
   */
  recordLessonSession(record: LessonRecord): Promise<SaveOutcome>;
  /** Semua lesson selesai pada hari WIB tertentu (urut created_at). */
  getLessonsByDay(day: string): Promise<LessonRecord[]>;
  /** Semua lesson selesai (urut selesai) — rekap statistik profil dari lesson_log. */
  getAllLessons(): Promise<LessonRecord[]>;
  /** Catat bonus XP di xp_ledger (append-only, bukan state snapshot). */
  recordBonusXp(entry: BonusXpRecord): Promise<void>;
  /** Bonus XP pada hari WIB tertentu (urut pencatatan). */
  getBonusXpByDay(day: string): Promise<BonusXpRecord[]>;
  /** Semua bonus XP sepanjang waktu — supaya XP total Profil ikut lengkap. */
  getAllBonusXp(): Promise<BonusXpRecord[]>;
  /** Semua bookmark ayat (urut surah:ayat) — daftar "favorit" di layar mushaf. */
  getBookmarks(): Promise<AyahBookmark[]>;
  /** Tambah bookmark (idempoten pada surah:ayat) — kembalikan daftar terbaru. */
  addBookmark(surahId: number, ayahNumber: number): Promise<AyahBookmark[]>;
  /** Hapus bookmark; bookmark yang tidak ada TIDAK error (idempoten). */
  removeBookmark(surahId: number, ayahNumber: number): Promise<AyahBookmark[]>;
  /**
   * Hapus SELURUH data progres (progress_state, lesson_log, answer_log) tanpa
   * menyentuh skema — Profil → "Hapus semua data". WAJIB ada di repo: begitu
   * SQLite persist, reset di sisi UI saja tidak cukup (progres akan hidup lagi).
   */
  clearAll(): Promise<void>;
};

const COLUMNS_PROGRESS = "day, xp_total, streak_count, last_active_day, freeze_available, freeze_used_day, lessons_today, correct_today";

function rowToProgressDay(row: Record<string, unknown>): ProgressDayRow {
  return {
    day: row.day as string,
    xpTotal: row.xp_total as number,
    streakCount: row.streak_count as number,
    lastActiveDay: (row.last_active_day as string | null) ?? null,
    freezeAvailable: (row.freeze_available as number) === 1,
    freezeUsedDay: (row.freeze_used_day as string | null) ?? null,
    lessonsToday: row.lessons_today as number,
    correctToday: row.correct_today as number,
  };
}

function recordToParams(record: LessonRecord, fallbackIso: string): unknown[] {
  return [
    record.id,
    record.day,
    record.surahId,
    record.unitIndex,
    record.xpEarned,
    record.accuracy,
    record.perfect ? 1 : 0,
    JSON.stringify(record.events),
    record.completedAt || fallbackIso,
  ];
}

function recordFromRow(row: Record<string, unknown>): LessonRecord {
  return {
    id: row.id as string,
    day: row.day as string,
    surahId: row.surah_id as number,
    unitIndex: row.unit_index as number,
    xpEarned: row.xp_earned as number,
    accuracy: row.accuracy as number,
    perfect: (row.perfect as number) === 1,
    events: JSON.parse(row.events_json as string) as RepoLessonEvent[],
    completedAt: (row.created_at as string) ?? "",
  };
}

function bonusFromRow(row: Record<string, unknown>): BonusXpRecord {
  return {
    id: row.id as string,
    day: row.day as string,
    amount: row.amount as number,
    reason: row.reason as string,
    createdAt: (row.created_at as string) ?? "",
  };
}

function bookmarkFromRow(row: Record<string, unknown>): AyahBookmark {
  return {
    surahId: row.surah_id as number,
    ayahNumber: row.ayah_number as number,
    createdAt: (row.created_at as string) ?? "",
  };
}

// ---------------------------------------------------------------------------
// Implementasi expo-sqlite (runtime app).
// ---------------------------------------------------------------------------

/** Permukaan eksekusi minimal yang cocok dengan expo-sqlite (SDK 57, sync API). */
export type SqliteDb = {
  execAsync(source: string): Promise<void>;
  getAllAsync<T = Record<string, unknown>>(source: string, params?: unknown[]): Promise<T[]>;
  runAsync(source: string, params?: unknown[]): Promise<{ lastInsertRowId?: number | bigint; changes?: number | bigint }>;
  /** Bila tersedia: eksekusi beberapa statement dalam SATU transaksi. */
  withTransactionAsync?(work: () => Promise<void>): Promise<void>;
};

export class SqliteProgressRepo implements ProgressRepo {
  constructor(private readonly db: SqliteDb) {}

  async migrate(): Promise<void> {
    await this.db.execAsync(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)",
    );
    const applied = await this.db.getAllAsync<{ version: number }>("SELECT version FROM schema_migrations ORDER BY version");
    const appliedVersions = new Set(applied.map((row) => row.version));
    assertMigrationsValid(MIGRATIONS);
    for (const migration of MIGRATIONS) {
      if (appliedVersions.has(migration.version)) continue;
      await this.db.execAsync(migration.statements.join(";\n"));
      await this.db.runAsync("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)", [
        migration.version,
        migration.name,
        new Date().toISOString(),
      ]);
    }
  }

  async getProgressDay(day: string): Promise<ProgressDayRow | null> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      `SELECT ${COLUMNS_PROGRESS} FROM progress_state WHERE day = ?`,
      [day],
    );
    const row = rows[0];
    return row === undefined ? null : rowToProgressDay(row);
  }

  async getLatestProgressDayUpTo(day: string): Promise<ProgressDayRow | null> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      `SELECT ${COLUMNS_PROGRESS} FROM progress_state WHERE day <= ? ORDER BY day DESC LIMIT 1`,
      [day],
    );
    const row = rows[0];
    return row === undefined ? null : rowToProgressDay(row);
  }

  async saveProgressDay(rowData: ProgressDayRow): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO progress_state (${COLUMNS_PROGRESS}, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(day) DO UPDATE SET
         xp_total = excluded.xp_total,
         streak_count = excluded.streak_count,
         last_active_day = excluded.last_active_day,
         freeze_available = excluded.freeze_available,
         freeze_used_day = excluded.freeze_used_day,
         lessons_today = excluded.lessons_today,
         correct_today = excluded.correct_today,
         updated_at = excluded.updated_at`,
      [
        rowData.day,
        rowData.xpTotal,
        rowData.streakCount,
        rowData.lastActiveDay,
        rowData.freezeAvailable ? 1 : 0,
        rowData.freezeUsedDay,
        rowData.lessonsToday,
        rowData.correctToday,
        new Date().toISOString(),
      ],
    );
  }

  async recordLessonSession(record: LessonRecord): Promise<SaveOutcome> {
    const nowIso = new Date().toISOString();
    const lessonParams = recordToParams(record, nowIso);

    const runAll = async (): Promise<void> => {
      await this.db.runAsync(
        `INSERT INTO lesson_log (id, day, surah_id, unit_index, xp_earned, accuracy, perfect, events_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        lessonParams,
      );
      for (const event of record.events) {
        if (event.type !== "ANSWER_CORRECT" && event.type !== "ANSWER_WRONG") continue;
        await this.db.runAsync(
          `INSERT INTO answer_log (id, lesson_id, day, question_id, kind, is_retry, with_hint, verdict, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `${record.id}:${event.questionId ?? ""}:${event.type}`,
            record.id,
            record.day,
            event.questionId ?? "",
            event.kind,
            event.isRetry ? 1 : 0,
            event.type === "ANSWER_CORRECT" && event.withHint ? 1 : 0,
            event.type === "ANSWER_CORRECT" ? "correct" : "wrong",
            nowIso,
          ],
        );
      }
    };

    if (this.db.withTransactionAsync !== undefined) {
      try {
        await this.db.withTransactionAsync(runAll);
      } catch (error) {
        if (isUniqueViolation(error)) return "duplicate";
        throw error;
      }
      return "saved";
    }

    try {
      await runAll();
    } catch (error) {
      if (isUniqueViolation(error)) return "duplicate";
      throw error;
    }
    return "saved";
  }

  async getLessonsByDay(day: string): Promise<LessonRecord[]> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      "SELECT id, day, surah_id, unit_index, xp_earned, accuracy, perfect, events_json FROM lesson_log WHERE day = ? ORDER BY created_at",
      [day],
    );
    return rows.map(recordFromRow);
  }

  async getAllLessons(): Promise<LessonRecord[]> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      "SELECT id, day, surah_id, unit_index, xp_earned, accuracy, perfect, events_json, created_at FROM lesson_log ORDER BY created_at, id",
    );
    return rows.map(recordFromRow);
  }

  async recordBonusXp(entry: BonusXpRecord): Promise<void> {
    await this.db.runAsync(
      "INSERT INTO xp_ledger (id, day, amount, reason, created_at) VALUES (?, ?, ?, ?, ?)",
      [entry.id, entry.day, entry.amount, entry.reason, entry.createdAt],
    );
  }

  async getBonusXpByDay(day: string): Promise<BonusXpRecord[]> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      "SELECT id, day, amount, reason, created_at FROM xp_ledger WHERE day = ? ORDER BY created_at, id",
      [day],
    );
    return rows.map(bonusFromRow);
  }

  async getAllBonusXp(): Promise<BonusXpRecord[]> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      "SELECT id, day, amount, reason, created_at FROM xp_ledger ORDER BY created_at, id",
    );
    return rows.map(bonusFromRow);
  }

  async getBookmarks(): Promise<AyahBookmark[]> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      "SELECT surah_id, ayah_number, created_at FROM ayah_bookmark ORDER BY surah_id, ayah_number",
    );
    return rows.map(bookmarkFromRow);
  }

  async addBookmark(surahId: number, ayahNumber: number): Promise<AyahBookmark[]> {
    // INSERT OR IGNORE, bukan ON CONFLICT DO NOTHING yang butuh support SQLite
    // versi lebih baru: idempoten tanpa melihat error "sudah ada" pun.
    await this.db.runAsync(
      "INSERT OR IGNORE INTO ayah_bookmark (surah_id, ayah_number, created_at) VALUES (?, ?, ?)",
      [surahId, ayahNumber, new Date().toISOString()],
    );
    return this.getBookmarks();
  }

  async removeBookmark(surahId: number, ayahNumber: number): Promise<AyahBookmark[]> {
    await this.db.runAsync("DELETE FROM ayah_bookmark WHERE surah_id = ? AND ayah_number = ?", [
      surahId,
      ayahNumber,
    ]);
    return this.getBookmarks();
  }

  async clearAll(): Promise<void> {
    // schema_migrations SENGAJA dibiarkan: skema tetap utuh, tidak perlu migrasi ulang.
    const wipe = async (): Promise<void> => {
      for (const table of DATA_TABLES) {
        await this.db.runAsync(`DELETE FROM ${table}`);
      }
    };
    if (this.db.withTransactionAsync !== undefined) {
      await this.db.withTransactionAsync(wipe);
      return;
    }
    await wipe();
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && (error.message.includes("UNIQUE") || error.message.includes("unique"));
}

/**
 * Tabel data yang harus dikosongkan saat "Hapus semua data" — DITURUNKAN dari
 * MIGRATIONS, bukan diketik manual: tabel baru dari migrasi berikutnya otomatis
 * ikut terhapus, jadi tidak ada data user nyangkut di tabel yang terlewat.
 * schema_migrations dikecualikan (itu metadata skema, bukan data).
 */
const DATA_TABLES: readonly string[] = [
  ...new Set(
    MIGRATIONS.flatMap((migration) => migration.statements)
      .map((sql) => /CREATE TABLE IF NOT EXISTS\s+(\w+)/i.exec(sql)?.[1])
      .filter((name): name is string => name !== undefined && name !== "schema_migrations"),
  ),
];

// ---------------------------------------------------------------------------
// Implementasi in-memory (unit & integration test — ARCHITECTURE.md § 8).
// ---------------------------------------------------------------------------

export class InMemoryProgressRepo implements ProgressRepo {
  readonly progressDays = new Map<string, ProgressDayRow>();
  readonly lessons = new Map<string, LessonRecord>();
  readonly bonusXp = new Map<string, BonusXpRecord>();
  readonly bookmarks = new Map<string, AyahBookmark>();
  migrated = false;

  async migrate(): Promise<void> {
    this.migrated = true;
  }

  async getProgressDay(day: string): Promise<ProgressDayRow | null> {
    return this.progressDays.get(day) ?? null;
  }

  async saveProgressDay(rowData: ProgressDayRow): Promise<void> {
    this.progressDays.set(rowData.day, { ...rowData });
  }

  async getLatestProgressDayUpTo(day: string): Promise<ProgressDayRow | null> {
    const keys = [...this.progressDays.keys()].filter((d) => d <= day).sort();
    const latest = keys[keys.length - 1];
    if (latest === undefined) return null;
    const row = this.progressDays.get(latest);
    return row === undefined ? null : { ...row };
  }

  async recordLessonSession(record: LessonRecord): Promise<SaveOutcome> {
    if (this.lessons.has(record.id)) return "duplicate";
    this.lessons.set(record.id, structuredClone(record));
    return "saved";
  }

  async getLessonsByDay(day: string): Promise<LessonRecord[]> {
    return [...this.lessons.values()]
      .filter((lesson) => lesson.day === day)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  async getAllLessons(): Promise<LessonRecord[]> {
    return [...this.lessons.values()].sort(
      (a, b) => a.completedAt.localeCompare(b.completedAt) || a.id.localeCompare(b.id),
    );
  }

  async recordBonusXp(entry: BonusXpRecord): Promise<void> {
    if (this.bonusXp.has(entry.id)) return; // ledger append-only & idempoten pada id
    this.bonusXp.set(entry.id, structuredClone(entry));
  }

  async getBonusXpByDay(day: string): Promise<BonusXpRecord[]> {
    return [...this.bonusXp.values()]
      .filter((entry) => entry.day === day)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }

  async getAllBonusXp(): Promise<BonusXpRecord[]> {
    return [...this.bonusXp.values()].sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
  }

  async getBookmarks(): Promise<AyahBookmark[]> {
    return [...this.bookmarks.values()].sort(
      (a, b) => a.surahId - b.surahId || a.ayahNumber - b.ayahNumber,
    );
  }

  async addBookmark(surahId: number, ayahNumber: number): Promise<AyahBookmark[]> {
    const key = `${surahId}:${ayahNumber}`;
    if (!this.bookmarks.has(key)) {
      this.bookmarks.set(key, { surahId, ayahNumber, createdAt: new Date().toISOString() });
    }
    return this.getBookmarks();
  }

  async removeBookmark(surahId: number, ayahNumber: number): Promise<AyahBookmark[]> {
    this.bookmarks.delete(`${surahId}:${ayahNumber}`);
    return this.getBookmarks();
  }

  async clearAll(): Promise<void> {
    this.progressDays.clear();
    this.lessons.clear();
    this.bonusXp.clear();
    this.bookmarks.clear();
  }
}
