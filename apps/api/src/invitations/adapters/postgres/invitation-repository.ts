import { randomUUID } from 'node:crypto';

import type { Pool } from 'pg';
import { z } from 'zod';

import {
  InvitationCondoNotFoundError,
  InvitationOrganizationNotFoundError,
  InvitationResidentNotFoundError,
  PendingInvitationConflictError,
} from '../../domain/errors';
import {
  effectiveStatus,
  type Invitation,
  type InvitationBase,
  type MembroInvitation,
  type MoradorInvitation,
  type SindicoInvitation,
} from '../../domain/invitation';
import type {
  CondoInvitationRepository,
  CreateInvitationInput,
  CreateMembroInvitationInput,
  CreateSindicoInvitationInput,
  InvitationTokenRepository,
  OrgInvitationRepository,
} from '../../domain/invitation-repository';

const baseRowSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  status: z.enum(['pendente', 'aceito', 'revogado']),
  expires_at: z.date(),
  created_by: z.string(),
  claimed_by: z.string().nullable(),
  accepted_at: z.date().nullable(),
  created_at: z.date(),
});

const moradorRowSchema = baseRowSchema.extend({
  role: z.literal('morador'),
  condominium_id: z.string(),
  resident_id: z.string(),
});

const sindicoRowSchema = baseRowSchema.extend({
  role: z.literal('sindico'),
  condominium_id: z.string(),
  email: z.string(),
});

const membroRowSchema = baseRowSchema.extend({
  role: z.literal('membro'),
  organization_id: z.string(),
  org_role: z.enum(['owner', 'member']),
  email: z.string(),
});

const invitationRowSchema = z.discriminatedUnion('role', [
  moradorRowSchema,
  sindicoRowSchema,
  membroRowSchema,
]);

const ONE_PENDING_INDEXES = [
  'idx_invitations_one_pending',
  'idx_invitations_one_pending_sindico',
  'idx_invitations_one_pending_member',
];

function isPendingConflict(error: unknown): boolean {
  const { code, constraint } = (error ?? {}) as { code?: unknown; constraint?: unknown };
  return (
    code === '23505' && typeof constraint === 'string' && ONE_PENDING_INDEXES.includes(constraint)
  );
}

const COLUMNS =
  'id, role, condominium_id, resident_id, organization_id, org_role, email, status, expires_at, created_by, claimed_by, accepted_at, created_at';

function baseOf(row: z.infer<typeof baseRowSchema>, now: Date): InvitationBase {
  return {
    id: row.id,
    email: row.email,
    status: effectiveStatus(row.status, row.expires_at, now),
    expiresAt: row.expires_at,
    createdBy: row.created_by,
    claimedBy: row.claimed_by,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
  };
}

function fromMoradorRow(row: z.infer<typeof moradorRowSchema>, now: Date): MoradorInvitation {
  return {
    ...baseOf(row, now),
    role: 'morador',
    condominiumId: row.condominium_id,
    residentId: row.resident_id,
  };
}

function fromSindicoRow(row: z.infer<typeof sindicoRowSchema>, now: Date): SindicoInvitation {
  return {
    ...baseOf(row, now),
    role: 'sindico',
    condominiumId: row.condominium_id,
    email: row.email,
  };
}

function fromMembroRow(row: z.infer<typeof membroRowSchema>, now: Date): MembroInvitation {
  return {
    ...baseOf(row, now),
    role: 'membro',
    organizationId: row.organization_id,
    orgRole: row.org_role,
    email: row.email,
  };
}

function toInvitation(raw: unknown, now: Date): Invitation {
  const row = invitationRowSchema.parse(raw);
  if (row.role === 'morador') return fromMoradorRow(row, now);
  if (row.role === 'sindico') return fromSindicoRow(row, now);
  return fromMembroRow(row, now);
}

const toMorador = (raw: unknown, now: Date) => fromMoradorRow(moradorRowSchema.parse(raw), now);
const toSindico = (raw: unknown, now: Date) => fromSindicoRow(sindicoRowSchema.parse(raw), now);
const toMembro = (raw: unknown, now: Date) => fromMembroRow(membroRowSchema.parse(raw), now);

const REVOKE_PENDING_SINDICO = `UPDATE invitations SET status = 'revogado'
  WHERE condominium_id = $1 AND role = 'sindico' AND status = 'pendente'`;

export class PostgresInvitationRepository implements CondoInvitationRepository {
  constructor(
    private readonly pool: Pool,
    private readonly condominiumId: string,
  ) {}

  async latestForResident(
    residentId: string,
    now: Date = new Date(),
  ): Promise<MoradorInvitation | null> {
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS} FROM invitations
       WHERE condominium_id = $1 AND resident_id = $2 AND role = 'morador'
       ORDER BY created_at DESC, id DESC LIMIT 1`,
      [this.condominiumId, residentId],
    );
    return rows[0] ? toMorador(rows[0], now) : null;
  }

  async create(input: CreateInvitationInput, now: Date = new Date()): Promise<MoradorInvitation> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE invitations SET status = 'revogado'
         WHERE condominium_id = $1 AND resident_id = $2 AND status = 'pendente'`,
        [this.condominiumId, input.residentId],
      );
      const { rows } = await client.query(
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
      return toMorador(row, now);
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

  async latestSindico(now: Date = new Date()): Promise<SindicoInvitation | null> {
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS} FROM invitations
       WHERE condominium_id = $1 AND role = 'sindico'
       ORDER BY created_at DESC, id DESC LIMIT 1`,
      [this.condominiumId],
    );
    return rows[0] ? toSindico(rows[0], now) : null;
  }

  async createSindico(
    input: CreateSindicoInvitationInput,
    now: Date = new Date(),
  ): Promise<SindicoInvitation> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(REVOKE_PENDING_SINDICO, [this.condominiumId]);
      const { rows } = await client.query(
        `INSERT INTO invitations
           (id, condominium_id, role, email, token_hash, status, expires_at, created_by)
         SELECT $1, c.id, 'sindico', $3, $4, 'pendente', $5, $6
         FROM condominiums c WHERE c.id = $2
         RETURNING ${COLUMNS}`,
        [
          randomUUID(),
          this.condominiumId,
          input.email,
          input.tokenHash,
          input.expiresAt,
          input.createdBy,
        ],
      );
      const row = rows[0];
      if (!row) throw new InvitationCondoNotFoundError();
      await client.query('COMMIT');
      return toSindico(row, now);
    } catch (error) {
      await client.query('ROLLBACK');
      if (isPendingConflict(error)) throw new PendingInvitationConflictError();
      throw error;
    } finally {
      client.release();
    }
  }

  async revokeSindico(): Promise<void> {
    await this.pool.query(REVOKE_PENDING_SINDICO, [this.condominiumId]);
  }
}

export class PostgresInvitationTokenRepository implements InvitationTokenRepository {
  constructor(private readonly pool: Pool) {}

  async findByTokenHash(hash: string, now: Date = new Date()): Promise<Invitation | null> {
    const { rows } = await this.pool.query(
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

  async accept(id: string, userId: string, at: Date): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE invitations SET status = 'aceito', accepted_at = $3
       WHERE id = $1 AND claimed_by = $2 AND status = 'pendente'`,
      [id, userId, at],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async releaseClaims(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE invitations SET claimed_by = NULL WHERE claimed_by = $1 AND status = 'pendente'`,
      [userId],
    );
  }

  async claimedBy(userId: string, now: Date = new Date()): Promise<Invitation[]> {
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS} FROM invitations
       WHERE claimed_by = $1 AND status = 'pendente' ORDER BY created_at`,
      [userId],
    );
    return rows.map((row) => toInvitation(row, now));
  }
}

const REVOKE_PENDING_MEMBER = `UPDATE invitations SET status = 'revogado'
  WHERE organization_id = $1 AND email = $2 AND role = 'membro' AND status = 'pendente'`;

export class PostgresOrgInvitationRepository implements OrgInvitationRepository {
  constructor(private readonly pool: Pool) {}

  async pending(organizationId: string, now: Date = new Date()): Promise<MembroInvitation[]> {
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS} FROM invitations
       WHERE organization_id = $1 AND role = 'membro' AND status = 'pendente' AND expires_at > $2
       ORDER BY created_at, id`,
      [organizationId, now],
    );
    return rows.map((row) => toMembro(row, now));
  }

  async create(
    input: CreateMembroInvitationInput,
    now: Date = new Date(),
  ): Promise<MembroInvitation> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(REVOKE_PENDING_MEMBER, [input.organizationId, input.email]);
      const { rows } = await client.query(
        `INSERT INTO invitations
           (id, organization_id, org_role, role, email, token_hash, status, expires_at, created_by)
         SELECT $1, o.id, $3, 'membro', $4, $5, 'pendente', $6, $7
         FROM organizations o WHERE o.id = $2 AND o.active
         RETURNING ${COLUMNS}`,
        [
          randomUUID(),
          input.organizationId,
          input.orgRole,
          input.email,
          input.tokenHash,
          input.expiresAt,
          input.createdBy,
        ],
      );
      const row = rows[0];
      if (!row) throw new InvitationOrganizationNotFoundError();
      await client.query('COMMIT');
      return toMembro(row, now);
    } catch (error) {
      await client.query('ROLLBACK');
      if (isPendingConflict(error)) throw new PendingInvitationConflictError();
      throw error;
    } finally {
      client.release();
    }
  }

  async revoke(organizationId: string, id: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE invitations SET status = 'revogado'
       WHERE id = $2 AND organization_id = $1 AND role = 'membro' AND status = 'pendente'`,
      [organizationId, id],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
