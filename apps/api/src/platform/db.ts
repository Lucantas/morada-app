import Database from 'better-sqlite3';

export type Db = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS apartments (
  id TEXT PRIMARY KEY, label TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS residents (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  phone TEXT NOT NULL, email TEXT NOT NULL, status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS apartment_residents (
  id TEXT PRIMARY KEY, apartment_id TEXT NOT NULL, resident_id TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE (apartment_id, resident_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_resident_per_apartment
  ON apartment_residents (apartment_id) WHERE active = 1;
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY, description TEXT NOT NULL, category TEXT NOT NULL,
  date_label TEXT NOT NULL, value_cents INTEGER NOT NULL, status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY, ref TEXT NOT NULL, title TEXT NOT NULL,
  due_label TEXT NOT NULL, value_cents INTEGER NOT NULL, status TEXT NOT NULL, method TEXT,
  resident_id TEXT, apartment_id TEXT
);
CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, kind TEXT NOT NULL,
  audience TEXT NOT NULL, date_label TEXT NOT NULL, dismissed INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY, resident_name TEXT NOT NULL, apt TEXT NOT NULL,
  unread INTEGER NOT NULL, messages TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  role TEXT NOT NULL, resident_id TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_resident_id
  ON users (resident_id) WHERE resident_id IS NOT NULL;
`;

export function createDb(path: string): Db {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

export function createTestDb(): Db {
  return createDb(':memory:');
}
