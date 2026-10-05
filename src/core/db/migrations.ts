/**
 * Owner: core/db. Migrations SQLite device (ARCHITECTURE.md § 5) — append-only
 * untuk log (lesson_log/answer_log) agar statistik & quest bisa dihitung ulang
 * kapan saja; progress_state bisa direkonstruksi dari log (recovery path).
 * Tabel srs_item dibuat sejak v1 agar v2 tidak butuh migrasi merusak (§ 4.5).
 */

export type Migration = {
  /** Nomor versi skema — berurutan, tidak boleh ada gap. */
  version: number;
  name: string;
  statements: readonly string[];
};

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: "core-loop-duolingo",
    statements: [
      `CREATE TABLE IF NOT EXISTS profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        display_name TEXT NOT NULL,
        avatar TEXT NOT NULL,
        daily_target INTEGER NOT NULL DEFAULT 1,
        reciter_id TEXT NOT NULL,
        arab_font_scale TEXT NOT NULL DEFAULT 'M',
        reminder_hour INTEGER,
        streak_freeze_enabled INTEGER NOT NULL DEFAULT 1,
        onboarded INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS progress_state (
        day TEXT PRIMARY KEY,
        xp_total INTEGER NOT NULL,
        streak_count INTEGER NOT NULL,
        last_active_day TEXT,
        freeze_available INTEGER NOT NULL,
        freeze_used_day TEXT,
        lessons_today INTEGER NOT NULL DEFAULT 0,
        correct_today INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS lesson_log (
        id TEXT PRIMARY KEY,
        day TEXT NOT NULL,
        surah_id INTEGER NOT NULL,
        unit_index INTEGER NOT NULL,
        xp_earned INTEGER NOT NULL,
        accuracy REAL NOT NULL,
        perfect INTEGER NOT NULL,
        events_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_lesson_log_day ON lesson_log (day)`,
      `CREATE TABLE IF NOT EXISTS answer_log (
        id TEXT PRIMARY KEY,
        lesson_id TEXT NOT NULL REFERENCES lesson_log (id),
        day TEXT NOT NULL,
        question_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        is_retry INTEGER NOT NULL,
        with_hint INTEGER NOT NULL,
        verdict TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_answer_log_day ON answer_log (day)`,
      `CREATE TABLE IF NOT EXISTS achievements (
        id TEXT PRIMARY KEY,
        unlocked_day TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS srs_item (
        id TEXT PRIMARY KEY,
        surah_id INTEGER NOT NULL,
        ayah_number INTEGER NOT NULL,
        ease REAL NOT NULL DEFAULT 2.5,
        interval_days INTEGER NOT NULL DEFAULT 0,
        due_day TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (surah_id, ayah_number)
      )`,
    ],
  },
  {
    // v2: XP di luar lesson (hadiah quest) TIDAK bisa direkonstruksi dari
    // lesson_log karena tidak punya event jawaban. Tanpanya, bonus quest hilang
    // tiap app dibuka — reconcile menghitung ulang XP dari lesson_log saja.
    // Ledger append-only supaya XP total tetap bisa dihitung ulang kapan saja,
    // sama seperti lesson_log (ARCHITECTURE.md § 5).
    version: 2,
    name: "xp-ledger-bonus",
    statements: [
      `CREATE TABLE IF NOT EXISTS xp_ledger (
        id TEXT PRIMARY KEY,
        day TEXT NOT NULL,
        amount INTEGER NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_xp_ledger_day ON xp_ledger (day)`,
    ],
  },
  {
    // v3: bookmark favorit ayat. Berbeda dari reading store (posisi baca) yang
    // sudah di AsyncStorage, ini DITARUH di SQLite karena dua alasan:
    //   1. "Hapus semua data" (RULES § 8) mengosongkan tabel, dan tabel baru
    //      ikut kosong otomatis karena DATA_TABLES diturunkan dari MIGRATIONS.
    //      Kalau di AsyncStorage, NULLIFY harus dijaga manual di tiap tempat.
    //   2. Ini data pilihan user, bukan posisi sementara — tidak boleh hilang
    //      diam-diam karena storage gagal dibuka.
    // Append-only TIDAK berlaku di sini (user memang menghapus bookmark), jadi
    // seperti lesson_log/answer_log/xp_ledger.
    version: 3,
    name: "ayah-bookmark",
    statements: [
      `CREATE TABLE IF NOT EXISTS ayah_bookmark (
        surah_id INTEGER NOT NULL,
        ayah_number INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (surah_id, ayah_number)
      )`,
    ],
  },
];

/** Verifikasi integritas daftar migrasi — dipanggil test & saat startup. */
export function assertMigrationsValid(migrations: readonly Migration[] = MIGRATIONS): void {
  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new Error(`Migrasi versi ${migration.version} tidak berurutan (posisi ${index})`);
    }
  });
}
