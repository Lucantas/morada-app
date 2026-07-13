import bcrypt from 'bcryptjs';

import { config } from './platform/config';
import type { Db } from './platform/db';

/**
 * Documented demo logins so the deployed app is reachable out of the box. The
 * admin creates all other data in-app. Change these before any real deployment;
 * they are intentionally weak and public.
 */
export const demoCredentials = {
  admin: { username: 'admin', password: 'morada-admin' },
  resident: { username: 'maria302', password: 'morada-demo', residentId: 'r-1' },
} as const;

// The one resident behind the demo resident login, so `maria302` has a real
// record to read. This is part of the login seed — every other resident,
// account, receipt, notice and thread is created through the app.
const demoResident = {
  id: demoCredentials.resident.residentId,
  name: 'Maria Ribeiro',
  apt: 'Apto 302',
  phone: '(11) 90000-0001',
  email: 'maria@email.com',
  status: 'em_dia',
};

const USER_COLUMNS = ['id', 'username', 'password_hash', 'role', 'resident_id'];

function seedUsers(): Record<string, unknown>[] {
  return [
    {
      id: 'u-admin',
      username: demoCredentials.admin.username,
      password_hash: bcrypt.hashSync(demoCredentials.admin.password, config.bcryptCost),
      role: 'admin',
      resident_id: null,
    },
    {
      id: 'u-maria',
      username: demoCredentials.resident.username,
      password_hash: bcrypt.hashSync(demoCredentials.resident.password, config.bcryptCost),
      role: 'resident',
      resident_id: demoCredentials.resident.residentId,
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

// Seeds only what the demo logins need: the admin + resident users and the one
// resident record the resident login points at. No demo fixtures.
export function seedDatabase(db: Db): void {
  if (isEmpty(db, 'residents'))
    insertAll(db, 'residents', ['id', 'name', 'apt', 'phone', 'email', 'status'], [demoResident]);
  if (isEmpty(db, 'users')) insertAll(db, 'users', USER_COLUMNS, seedUsers());
}
