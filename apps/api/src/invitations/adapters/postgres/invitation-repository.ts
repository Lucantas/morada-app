import { randomUUID } from 'node:crypto';

import type { Pool } from 'pg';

import {
  InvitationResidentNotFoundError,
  PendingInvitationConflictError,
} from '../../domain/errors';
import {
  effectiveStatus,
  type Invitation,
  type StoredInvitationStatus,
} from '../../domain/invitation';
import type {
  CondoInvitationRepository,
  CreateInvitationInput,
  InvitationTokenRepository,
} from '../../domain/invitation-repository';

interface InvitationRow {
  id: string;
  condominium_id: string;
  resident_id: string;
  email: string | null;
  status: StoredInvitationStatus;
  expires_at: Date;
  created_by: string;
  claimed_by: string | null;
  accepted_at: Date | null;
  created_at: Date;
}

const ONE_PENDING_INDEX = 'idx_invitations_one_pending';

function isPendingConflict(error: unknown): boolean {
  const { code, constraint } = (error ?? {}) as { code?: unknown; constraint?: unknown };
  return code === '23505' && constraint === ONE_PENDING_INDEX;
}

const COLUMNS =
  'id, condominium_id, resident_id, email, status, expires_at, created_by, claimed_by, accepted_at, created_at';

function toInvitation(row: InvitationRow, now: Date): Invitation {
  return {
    id: row.id,
    condominiumId: row.condominium_id,
    residentId: row.resident_id,
    role: 'morador',
    email: row.email,
    status: effectiveStatus(row.status, row.expires_at, now),
    expiresAt: row.expires_at,
    createdBy: row.created_by,
    claimedBy: row.claimed_by,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
  };
}

export class PostgresInvitationRepository implements CondoInvitationRepository {
  constructor(
    private readonly pool: Pool,
    private readonly condominiumId: string,
  ) {}

  async latestForResident(residentId: string, now: Date = new Date()): Promise<Invitation | null> {
    const { rows } = await this.pool.query<InvitationRow>(
      `SELECT ${COLUMNS} FROM invitations
       WHERE condominium_id = $1 AND resident_id = $2
       ORDER BY created_at DESC, id DESC LIMIT 1`,
      [this.condominiumId, residentId],
    );
    return rows[0] ? toInvitation(rows[0], now) : null;
  }

  async create(input: CreateInvitationInput, now: Date = new Date()): Promise<Invitation> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE invitations SET status = 'revogado'
         WHERE condominium_id = $1 AND resident_id = $2 AND status = 'pendente'`,
        [this.condominiumId, input.residentId],
      );
      const { rows } = await client.query<InvitationRow>(
        `INSERT INTO invitations
           (id, condominium_id, resident_id, role, email, token_hash, status, expires_at, created_by)
         SELECT $1, $2, r.id, 'morador', $4, $5, 'pendente', $6, $7
         FROM residents r WHERE r.id = $3 AND r.condominium_id = $2
         RETURNING ${COLUMNS}`,
        [
          randomUUID(),
          this.condominiumId,
          input.residentId,
          input.email,
          input.tokenHash,
          input.expiresAt,
          input.createdBy,
        ],
      );
      const row = rows[0];
      if (!row) throw new InvitationResidentNotFoundError(input.residentId);
      await client.query('COMMIT');
      return toInvitation(row, now);
    } catch (error) {
      await client.query('ROLLBACK');
      if (isPendingConflict(error)) throw new PendingInvitationConflictError();
      throw error;
    } finally {
      client.release();
    }
  }

  async revoke(residentId: string): Promise<void> {
    await this.pool.query(
      `UPDATE invitations SET status = 'revogado'
       WHERE condominium_id = $1 AND resident_id = $2 AND status = 'pendente'`,
      [this.condominiumId, residentId],
    );
  }
}

export class PostgresInvitationTokenRepository implements InvitationTokenRepository {
  constructor(private readonly pool: Pool) {}

  async findByTokenHash(hash: string, now: Date = new Date()): Promise<Invitation | null> {
    const { rows } = await this.pool.query<InvitationRow>(
      `SELECT ${COLUMNS} FROM invitations WHERE token_hash = $1`,
      [hash],
    );
    return rows[0] ? toInvitation(rows[0], now) : null;
  }

  async claim(id: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE invitations SET claimed_by = $2
       WHERE id = $1 AND claimed_by IS NULL AND status = 'pendente'`,
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async accept(id: string, at: Date): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE invitations SET status = 'aceito', accepted_at = $2
       WHERE id = $1 AND status = 'pendente'`,
      [id, at],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async claimedBy(userId: string, now: Date = new Date()): Promise<Invitation[]> {
    const { rows } = await this.pool.query<InvitationRow>(
      `SELECT ${COLUMNS} FROM invitations
       WHERE claimed_by = $1 AND status = 'pendente' ORDER BY created_at`,
      [userId],
    );
    return rows.map((row) => toInvitation(row, now));
  }
}
