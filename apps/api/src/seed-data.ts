import bcrypt from 'bcryptjs';

import { config } from './platform/config';
import type { Db } from './platform/db';

/**
 * The ONLY seeded login: the admin (síndico). Everything else — residents, their
 * logins, accounts, receipts, notices — is created through the app. Change this
 * before any real deployment; it is intentionally weak and public.
 */
export const adminCredentials = { username: 'admin', password: 'morada-admin' } as const;

const USER_COLUMNS = ['id', 'username', 'password_hash', 'role', 'resident_id'];

function seedUsers(): Record<string, unknown>[] {
  return [
    {
      id: 'u-admin',
      username: adminCredentials.username,
      password_hash: bcrypt.hashSync(adminCredentials.password, config.bcryptCost),
      role: 'admin',
      resident_id: null,
    },
  ];
}

export function isEmpty(db: Db, table: string): boolean {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
  return row.n === 0;
}

export function insertAll(
  db: Db,
  table: string,
  columns: string[],
  rows: Record<string, unknown>[],
): void {
  const placeholders = columns.map((c) => `@${c}`).join(', ');
  const stmt = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`);
  const tx = db.transaction((items: Record<string, unknown>[]) => {
    for (const item of items) stmt.run(item);
  });
  tx(rows);
}

// Seeds only the admin login. Residents (and their logins) are created in-app.
export function seedDatabase(db: Db): void {
  if (isEmpty(db, 'users')) insertAll(db, 'users', USER_COLUMNS, seedUsers());
}
