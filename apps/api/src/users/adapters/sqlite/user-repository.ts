import type { Db } from '../../../platform/db';
import { userSchema, type User } from '../../domain/user';
import type { UserRepository } from '../../domain/user-repository';

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  resident_id: string | null;
}

function toUser(row: unknown): User {
  const r = row as UserRow;
  return userSchema.parse({
    id: r.id,
    username: r.username,
    passwordHash: r.password_hash,
    role: r.role,
    residentId: r.resident_id,
  });
}

export class SqliteUserRepository implements UserRepository {
  constructor(private readonly db: Db) {}

  findByUsername(username: string): User | null {
    const row = this.db
      .prepare(
        'SELECT id, username, password_hash, role, resident_id FROM users WHERE username = ?',
      )
      .get(username);
    return row ? toUser(row) : null;
  }

  existsByUsername(username: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM users WHERE username = ?').get(username);
    return row !== undefined;
  }

  existsByResidentId(residentId: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM users WHERE resident_id = ?').get(residentId);
    return row !== undefined;
  }

  save(user: User): User {
    this.db
      .prepare(
        `INSERT INTO users (id, username, password_hash, role, resident_id)
         VALUES (@id, @username, @passwordHash, @role, @residentId)
         ON CONFLICT(id) DO UPDATE SET
           username = @username, password_hash = @passwordHash,
           role = @role, resident_id = @residentId`,
      )
      .run(user);
    return user;
  }
}
