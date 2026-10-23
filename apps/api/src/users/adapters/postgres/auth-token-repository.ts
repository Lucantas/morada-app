import { randomUUID } from 'node:crypto';

import type { Pool } from 'pg';

import type { AuthTokenKind } from '../../domain/auth-token';
import type { AuthTokenRepository, IssueAuthToken } from '../../domain/auth-token-repository';

export class PostgresAuthTokenRepository implements AuthTokenRepository {
  constructor(private readonly pool: Pool) {}

  async issue(token: IssueAuthToken): Promise<void> {
    await this.pool.query(
      `INSERT INTO auth_tokens (id, user_id, kind, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), token.userId, token.kind, token.tokenHash, token.expiresAt],
    );
  }

  async consume(
    tokenHash: string,
    kind: AuthTokenKind,
    now: Date,
  ): Promise<{ userId: string } | null> {
    const { rows } = await this.pool.query<{ user_id: string }>(
      `UPDATE auth_tokens SET used_at = $3
       WHERE token_hash = $1 AND kind = $2 AND used_at IS NULL AND expires_at > $3
       RETURNING user_id`,
      [tokenHash, kind, now],
    );
    return rows[0] ? { userId: rows[0].user_id } : null;
  }

  async revokeAll(userId: string, kind: AuthTokenKind, now: Date): Promise<void> {
    await this.pool.query(
      `UPDATE auth_tokens SET used_at = $3
       WHERE user_id = $1 AND kind = $2 AND used_at IS NULL`,
      [userId, kind, now],
    );
  }
}
