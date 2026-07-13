export interface Migration {
  id: string;
  sql: string;
}

// Ordered schema migrations, mirroring the SQLite schema in platform/db.ts.
// SQLite integers-as-booleans (active/dismissed/unread) become native BOOLEAN;
// the partial unique indexes carry the same invariants (one active resident per
// apartment, one login per resident).
export const migrations: Migration[] = [
  {
    id: '001_init',
    sql: `
CREATE TABLE apartments (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE
);

CREATE TABLE residents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE apartment_residents (
  id TEXT PRIMARY KEY,
  apartment_id TEXT NOT NULL,
  resident_id TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (apartment_id, resident_id)
);

CREATE UNIQUE INDEX idx_one_active_resident_per_apartment
  ON apartment_residents (apartment_id) WHERE active;

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  date_label TEXT NOT NULL,
  value_cents INTEGER NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE receipts (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL,
  title TEXT NOT NULL,
  due_label TEXT NOT NULL,
  value_cents INTEGER NOT NULL,
  status TEXT NOT NULL,
  method TEXT,
  resident_id TEXT,
  apartment_id TEXT
);

CREATE TABLE notices (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL,
  audience TEXT NOT NULL,
  date_label TEXT NOT NULL,
  dismissed BOOLEAN NOT NULL
);

CREATE TABLE threads (
  id TEXT PRIMARY KEY,
  resident_name TEXT NOT NULL,
  apt TEXT NOT NULL,
  unread BOOLEAN NOT NULL,
  messages TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  resident_id TEXT
);

CREATE UNIQUE INDEX idx_users_resident_id
  ON users (resident_id) WHERE resident_id IS NOT NULL;
`,
  },
];
