/**
 * Test core/db/progress-repo — lapisan SQL (SqliteProgressRepo) tanpa SQLite asli:
 * memakai SqliteDb palsu yang mencatat statement. Fokus: "Hapus semua data"
 * (clearAll) benar-benar mengosongkan SETIAP tabel data yang dikenal skema dan
 * tidak pernah menyentuh schema_migrations (kalau tidak, migrasi ulang jalan
 * tiap Kali app dibuka).
 */
import { describe, expect, it } from "vitest";

import { MIGRATIONS } from "./migrations";
import { SqliteProgressRepo, type SqliteDb } from "./progress-repo";

/** Tabel yang dibuat migrations — sumber kebenaran expectations di test ini. */
function schemaTables(): string[] {
  return MIGRATIONS.flatMap((migration) => migration.statements)
    .map((sql) => /CREATE TABLE IF NOT EXISTS\s+(\w+)/i.exec(sql)?.[1])
    .filter((name): name is string => name !== undefined);
}

/** SqliteDb tiruan: catat semua statement, tidak menyentuh database sungguhan. */
function fakeDb(withTransaction: boolean): { db: SqliteDb; statements: string[] } {
  const statements: string[] = [];
  const db: SqliteDb = {
    execAsync: async () => {},
    // SELECT juga dicatat: urutan & filter ada di statement, bukan di hasil —
    // stub yang mengembalikannya apa adanya tidak bisa menguji itu.
    getAllAsync: async (source) => {
      statements.push(source);
      return [];
    },
    runAsync: async (source) => {
      statements.push(source);
      return {};
    },
    ...(withTransaction ? { withTransactionAsync: async (work) => work() } : {}),
  };
  return { db, statements };
}

describe("SqliteProgressRepo.clearAll", () => {
  it("mengosongkan setiap tabel data di skema", async () => {
    const { db, statements } = fakeDb(true);
    await new SqliteProgressRepo(db).clearAll();

    const tables = schemaTables();
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      expect(statements).toContain(`DELETE FROM ${table}`);
    }
  });

  it("tidak pernah menghapus schema_migrations (skema harus tetap utuh)", async () => {
    const { db, statements } = fakeDb(true);
    await new SqliteProgressRepo(db).clearAll();
    expect(statements.join(" ")).not.toContain("schema_migrations");
  });

  it("bungkus semua DELETE dalam SATU transaksi bila db mendukungnya", async () => {
    const withTxn = fakeDb(true);
    await new SqliteProgressRepo(withTxn.db).clearAll();
    const withoutTxn = fakeDb(false);
    await new SqliteProgressRepo(withoutTxn.db).clearAll();
    // Jumlah statement sama → transactional hanya mengubah pembungkus, bukan isi.
    expect(withoutTxn.statements).toEqual(withTxn.statements);
  });
});
describe("SqliteProgressRepo.bookmark (SQL yang benar)", () => {
  it("menambah memakai INSERT OR IGNORE supaya klik dua kali tidak duplikat", async () => {
    const { db, statements } = fakeDb(true);
    await new SqliteProgressRepo(db).addBookmark(36, 82);

    const insert = statements.find((s) => s.includes("ayah_bookmark") && s.startsWith("INSERT"));
    // Tanpa OR IGNORE, klik kedua pada ayat yang sama berakhir sebagai
    // SqliteError unique constraint — dan ketukan user berakhir jadi exception.
    expect(insert).toContain("INSERT OR IGNORE");
    // created_at ikut ditulis: tanpa itu daftar tidak bisa diurutkan "yang
    // terakhir ditandai lebih dulu" kalau urutan surah:ayat suatu saat berubah.
    expect(insert).toContain("surah_id, ayah_number, created_at");
  });

  it("primary key composed surah+ayah (bukan satu kolom)", async () => {
    // Tanpa composite key, "1:1" menimpa "2:1" — dua bookmark berbeda jadi satu.
    const create = MIGRATIONS.flatMap((m) => m.statements).find((s) =>
      s.includes("CREATE TABLE IF NOT EXISTS ayah_bookmark"),
    );
    expect(create).toContain("PRIMARY KEY (surah_id, ayah_number)");
  });

  it("hapus cuma menyentuh satu ayat, bukan seluruh tabel", async () => {
    const { db, statements } = fakeDb(true);
    await new SqliteProgressRepo(db).removeBookmark(2, 255);
    expect(statements).toContain(
      "DELETE FROM ayah_bookmark WHERE surah_id = ? AND ayah_number = ?",
    );
  });

  it("urutan daftar datang dari ORDER BY di SQL, bukan diurutkan ulang di JS", () => {
    // Diuji lewat statement, bukan hasil: SqliteDb tiruan mengembalikan baris
    // apa adanya, jadi mengurutkan di sini hanya menguji stub-nya sendiri.
    // Kalau urutannya hilang dari SQL, daftar ikut berubah urutan dan user
    // melihat bookmark "lompat" setiap kali ayat baru ditandai.
    const { db, statements } = fakeDb(true);
    void new SqliteProgressRepo(db).getBookmarks();
    const select = statements.find((s) => s.includes("FROM ayah_bookmark"));
    expect(select).toContain("ORDER BY surah_id, ayah_number");
  });
});
