import type { Db } from './platform/db';
import type { PasswordHasher } from './users/domain/password-hasher';
import type { User } from './users/domain/user';
import type { UserRepository } from './users/domain/user-repository';

/**
 * The ONLY seeded login: the admin (síndico). Everything else — residents, their
 * logins, accounts, receipts, notices — is created through the app. Change this
 * before any real deployment; it is intentionally weak and public.
 */
export const adminCredentials = { username: 'admin', password: 'morada-admin' } as const;

// Seeds only the admin login, through the repository so it works on any driver.
// Idempotent: a no-op once the admin exists.
export async function seedAdmin(users: UserRepository, hasher: PasswordHasher): Promise<void> {
  if (await users.findByUsername(adminCredentials.username)) return;
  const admin: User = {
    id: 'u-admin',
    username: adminCredentials.username,
    passwordHash: await hasher.hash(adminCredentials.password),
    role: 'admin',
    residentId: null,
  };
  await users.save(admin);
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
