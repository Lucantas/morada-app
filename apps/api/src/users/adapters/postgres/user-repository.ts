import type { Pool } from 'pg';

import { ResidentLoginExistsError } from '../../domain/errors';
import { userSchema, type User } from '../../domain/user';
import type { UserRepository } from '../../domain/user-repository';

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  resident_id: string | null;
}

function toUser(row: UserRow): User {
  return userSchema.parse({
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role,
    residentId: row.resident_id,
  });
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async findByUsername(username: string): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>(
      'SELECT id, username, password_hash, role, resident_id FROM users WHERE username = $1',
      [username],
    );
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findByResidentId(residentId: string): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>(
      'SELECT id, username, password_hash, role, resident_id FROM users WHERE resident_id = $1',
      [residentId],
    );
    return rows[0] ? toUser(rows[0]) : null;
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

  async save(user: User): Promise<User> {
    if (user.residentId !== null) {
      const taken = await this.pool.query(
        'SELECT id FROM users WHERE resident_id = $1 AND id != $2',
        [user.residentId, user.id],
      );
      if ((taken.rowCount ?? 0) > 0) throw new ResidentLoginExistsError(user.residentId);
    }
    await this.pool.query(
      `INSERT INTO users (id, username, password_hash, role, resident_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         username = EXCLUDED.username, password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role, resident_id = EXCLUDED.resident_id`,
      [user.id, user.username, user.passwordHash, user.role, user.residentId],
    );
    return user;
  }
}
