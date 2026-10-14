import Database from "better-sqlite3";
import { Kysely, SqliteDialect, type Generated } from "kysely";
import fs from "node:fs";
import path from "node:path";
import { databasePath } from "../config";
import { testDatabaseId, testDatabasePath } from "../test-support";
import { migrations } from "./migrations";

/** Typed table shapes; later tickets add their tables here. */
export interface DatabaseSchema {
  app_settings: { key: string; value: string };
  users: { id: Generated<number>; email: string; password_hash: string; created_at: string };
  sessions: { id: string; user_id: number; expires_at: string };
  shares: { task_id: number; recipient_id: number; role: "view" | "edit"; created_at: string };
  tasks: {
    id: Generated<number>;
    owner_id: number;
    title: string;
    status: Generated<"todo" | "doing" | "done">;
    priority: Generated<"low" | "medium" | "high">;
    due_date: string | null;
    recurrence: Generated<"none" | "daily" | "weekly">;
    completed_at: string | null;
    created_at: string;
  };
}

export type Db = Kysely<DatabaseSchema>;

type Entry = { raw: Database.Database; db: Db };
const g = globalThis as unknown as { __tmDbs?: Map<string, Entry> };
const open = (g.__tmDbs ??= new Map<string, Entry>());

export function applyMigrations(raw: Database.Database): void {
  raw.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL)");
  const applied = new Set(
    (raw.prepare("SELECT version FROM schema_migrations").all() as { version: number }[]).map((r) => r.version),
  );
  for (const m of [...migrations].sort((a, b) => a.version - b.version)) {
    if (applied.has(m.version)) continue;
    raw.transaction(() => {
      raw.exec(m.sql);
      raw.prepare("INSERT INTO schema_migrations (version, name) VALUES (?, ?)").run(m.version, m.name);
    })();
  }
}

function closeAt(file: string): void {
  const entry = open.get(file);
  if (entry) {
    entry.raw.close();
    open.delete(file);
  }
}

function openAt(file: string): Db {
  const cached = open.get(file);
  if (cached && fs.existsSync(file)) return cached.db;
  if (cached) closeAt(file); // file was deleted underneath us
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = new Database(file);
  raw.pragma("journal_mode = WAL");
  raw.pragma("foreign_keys = ON");
  applyMigrations(raw);
  const db = new Kysely<DatabaseSchema>({ dialect: new SqliteDialect({ database: raw }) });
  open.set(file, { raw, db });
  return db;
}

/** The database for the current request (a per-test database in test mode). */
export async function getDb(): Promise<Db> {
  const id = await testDatabaseId();
  return openAt(id ? testDatabasePath(id) : path.resolve(databasePath()));
}

/** Test mode only: delete a test database so the next access starts empty. */
export function destroyTestDatabase(id: string): void {
  const file = testDatabasePath(id);
  closeAt(file);
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(file + suffix, { force: true });
}
