import type { Pool } from 'pg';

import { EmailTakenError, ResidentLoginExistsError } from '../../domain/errors';
import { userSchema, type User } from '../../domain/user';
import type { UserRepository } from '../../domain/user-repository';

interface UserRow {
  id: string;
  username: string | null;
  email: string | null;
  name: string | null;
  password_hash: string;
  role: string;
  resident_id: string | null;
  email_verified_at: Date | null;
  session_version: number;
}

const COLUMNS =
  'id, username, email, name, password_hash, role, resident_id, email_verified_at, session_version';
const UNIQUE_VIOLATION = '23505';
const EMAIL_INDEX = 'idx_users_email';

function toUser(row: UserRow): User {
  return userSchema.parse({
    id: row.id,
    username: row.username,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    role: row.role,
    residentId: row.resident_id,
    emailVerifiedAt: row.email_verified_at,
    sessionVersion: row.session_version,
  });
}

function isEmailConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, constraint } = error as { code?: unknown; constraint?: unknown };
  return code === UNIQUE_VIOLATION && constraint === EMAIL_INDEX;
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  private async findOne(column: string, value: string): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT ${COLUMNS} FROM users WHERE ${column} = $1`,
      [value],
    );
    return rows[0] ? toUser(rows[0]) : null;
  }

  findById(id: string): Promise<User | null> {
    return this.findOne('id', id);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.findOne('email', email);
  }

  findByUsername(username: string): Promise<User | null> {
    return this.findOne('username', username);
  }

  findByResidentId(residentId: string): Promise<User | null> {
    return this.findOne('resident_id', residentId);
  }

  async existsByEmail(email: string): Promise<boolean> {
    const { rowCount } = await this.pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    return (rowCount ?? 0) > 0;
  }

  async existsByUsername(username: string): Promise<boolean> {
    const { rowCount } = await this.pool.query('SELECT 1 FROM users WHERE username = $1', [
      username,
    ]);
    return (rowCount ?? 0) > 0;
  }

  async existsByResidentId(residentId: string): Promise<boolean> {
    const { rowCount } = await this.pool.query('SELECT 1 FROM users WHERE resident_id = $1', [
      residentId,
    ]);
    return (rowCount ?? 0) > 0;
  }

  async hasAny(): Promise<boolean> {
    const { rowCount } = await this.pool.query('SELECT 1 FROM users LIMIT 1');
    return (rowCount ?? 0) > 0;
  }

  async markEmailVerified(id: string, at: Date): Promise<void> {
    await this.pool.query('UPDATE users SET email_verified_at = $2 WHERE id = $1', [id, at]);
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [id, passwordHash]);
  }

  async updateCredentials(
    id: string,
    credentials: { name: string; passwordHash: string },
  ): Promise<void> {
    await this.pool.query('UPDATE users SET name = $2, password_hash = $3 WHERE id = $1', [
      id,
      credentials.name,
      credentials.passwordHash,
    ]);
  }

  async bumpSessionVersion(id: string): Promise<number> {
    const { rows } = await this.pool.query<{ session_version: number }>(
      'UPDATE users SET session_version = session_version + 1 WHERE id = $1 RETURNING session_version',
      [id],
    );
    const bumped = rows[0];
    if (!bumped) throw new Error(`User not found: ${id}`);
    return bumped.session_version;
  }

  async save(user: User): Promise<User> {
    if (user.residentId !== null) {
      const taken = await this.pool.query(
        'SELECT id FROM users WHERE resident_id = $1 AND id != $2',
        [user.residentId, user.id],
      );
      if ((taken.rowCount ?? 0) > 0) throw new ResidentLoginExistsError(user.residentId);
    }
    try {
      await this.pool.query(
        `INSERT INTO users (id, username, email, name, password_hash, role, resident_id, email_verified_at, session_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           username = EXCLUDED.username, email = EXCLUDED.email, name = EXCLUDED.name,
           password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
           resident_id = EXCLUDED.resident_id, email_verified_at = EXCLUDED.email_verified_at`,
        [
          user.id,
          user.username,
          user.email,
          user.name,
          user.passwordHash,
          user.role,
          user.residentId,
          user.emailVerifiedAt,
          user.sessionVersion,
        ],
      );
    } catch (error) {
      if (user.email !== null && isEmailConflict(error)) throw new EmailTakenError(user.email);
      throw error;
    }
    return user;
  }
}
