export type Migration = { version: number; name: string; sql: string };

/** Append-only. Never edit a migration that has shipped; add a new version. */
export const migrations: Migration[] = [
  {
    version: 1,
    name: "create app_settings",
    sql: `CREATE TABLE app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  },
  {
    version: 2,
    name: "create users and sessions",
    sql: `CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    )`,
  },
  {
    version: 3,
    name: "create tasks",
    sql: `CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
      due_date TEXT,
      recurrence TEXT NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none', 'daily', 'weekly')),
      completed_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX tasks_owner_id ON tasks (owner_id)`,
  },
  {
    version: 4,
    name: "create shares",
    // One share per (task, recipient). Deleting the task or the recipient removes the share.
    sql: `CREATE TABLE shares (
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('view', 'edit')),
      created_at TEXT NOT NULL,
      PRIMARY KEY (task_id, recipient_id)
    );
    CREATE INDEX shares_recipient_id ON shares (recipient_id)`,
  },
];
