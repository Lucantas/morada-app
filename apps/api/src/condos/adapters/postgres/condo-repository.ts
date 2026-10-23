import { randomUUID } from 'node:crypto';

import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

import { condoSettingsSchema } from '../../../settings/domain/condo-settings';
import { resolveAccess, type CondoAccess } from '../../domain/condo-access';
import type {
  CondoGrant,
  CondoRepository,
  CreateCondominiumInput,
} from '../../domain/condo-repository';
import { condominiumSchema, condoRoleNameSchema, type Condominium } from '../../domain/condominium';
import { CondoNotFoundError } from '../../domain/errors';

const DEFAULT_CATEGORIES = [
  { name: 'Água', keywords: 'água, agua, saneamento, esgoto' },
  { name: 'Energia', keywords: 'energia, luz, elétr, eletr' },
  { name: 'Serviços', keywords: 'limpeza, internet, portaria, serviço, servico, segurança' },
  { name: 'Manutenção', keywords: 'manutenção, manutencao, reparo, elevador, conserto, bomba' },
] as const;

const GRANTS_SQL = `
  SELECT c.id AS condominium_id, c.name, 'administrador' AS role, NULL AS resident_id
  FROM condominiums c
  JOIN organization_members m ON m.organization_id = c.organization_id
  WHERE m.user_id = $1 AND m.active AND m.role = 'owner' AND c.active
  UNION ALL
  SELECT c.id, c.name, r.role, r.resident_id
  FROM condo_roles r
  JOIN condominiums c ON c.id = r.condominium_id
  WHERE r.user_id = $1 AND r.active AND c.active
    AND (
      r.role <> 'morador'
      OR EXISTS (
        SELECT 1 FROM apartment_residents ar WHERE ar.resident_id = r.resident_id AND ar.active
      )
    )`;

const grantRowSchema = z.object({
  condominium_id: z.string(),
  name: z.string(),
  role: condoRoleNameSchema,
  resident_id: z.string().nullable(),
});

const condoRowSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  name: z.string(),
  active: z.boolean(),
});

const createInputSchema = condoSettingsSchema.extend({
  organizationId: z.string().min(1).max(64),
  name: condominiumSchema.shape.name,
});

const organizationInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  ownerUserId: z.string().min(1),
});

const grantInputSchema = z.object({
  condominiumId: z.string().min(1),
  userId: z.string().min(1),
  role: condoRoleNameSchema,
  residentId: z.string().min(1).nullable(),
});

function toCondominium(row: unknown): Condominium {
  const parsed = condoRowSchema.parse(row);
  return condominiumSchema.parse({
    id: parsed.id,
    organizationId: parsed.organization_id,
    name: parsed.name,
    active: parsed.active,
  });
}

function toAccess(row: unknown): CondoAccess {
  const parsed = grantRowSchema.parse(row);
  return {
    condominiumId: parsed.condominium_id,
    name: parsed.name,
    role: parsed.role,
    residentId: parsed.resident_id,
  };
}

export class PostgresCondoRepository implements CondoRepository {
  constructor(private readonly pool: Pool) {}

  async listForUser(userId: string): Promise<CondoAccess[]> {
    const { rows } = await this.pool.query(GRANTS_SQL, [userId]);
    return resolveAccess(rows.map(toAccess));
  }

  async accessFor(userId: string, condominiumId: string): Promise<CondoAccess | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM (${GRANTS_SQL}) grants WHERE condominium_id = $2`,
      [userId, condominiumId],
    );
    return resolveAccess(rows.map(toAccess))[0] ?? null;
  }

  async getById(condominiumId: string): Promise<Condominium | null> {
    const { rows } = await this.pool.query(
      'SELECT id, organization_id, name, active FROM condominiums WHERE id = $1',
      [condominiumId],
    );
    return rows[0] ? toCondominium(rows[0]) : null;
  }

  async rename(condominiumId: string, name: string): Promise<Condominium> {
    const parsedName = condominiumSchema.shape.name.parse(name);
    const { rows } = await this.pool.query(
      'UPDATE condominiums SET name = $2 WHERE id = $1 RETURNING id, organization_id, name, active',
      [condominiumId, parsedName],
    );
    if (!rows[0]) throw new CondoNotFoundError();
    return toCondominium(rows[0]);
  }

  async create(input: CreateCondominiumInput): Promise<Condominium> {
    const parsed = createInputSchema.parse(input);
    const id = randomUUID();
    return this.inTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO condominiums (id, organization_id, name) VALUES ($1, $2, $3)
         RETURNING id, organization_id, name, active`,
        [id, parsed.organizationId, parsed.name],
      );
      await client.query(
        'INSERT INTO condo_settings (condominium_id, monthly_fee_cents, due_day) VALUES ($1, $2, $3)',
        [id, parsed.monthlyFeeCents, parsed.dueDay],
      );
      for (const [position, category] of DEFAULT_CATEGORIES.entries()) {
        await client.query(
          `INSERT INTO categories (id, name, keywords, position, condominium_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [randomUUID(), category.name, category.keywords, position, id],
        );
      }
      return toCondominium(rows[0]);
    });
  }

  async createOrganization(input: { name: string; ownerUserId: string }): Promise<{ id: string }> {
    const parsed = organizationInputSchema.parse(input);
    const id = randomUUID();
    return this.inTransaction(async (client) => {
      await client.query('INSERT INTO organizations (id, name) VALUES ($1, $2)', [id, parsed.name]);
      await client.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role)
         VALUES ($1, $2, $3, 'owner')`,
        [randomUUID(), id, parsed.ownerUserId],
      );
      return { id };
    });
  }

  async grant(input: CondoGrant): Promise<void> {
    const parsed = grantInputSchema.parse(input);
    await this.pool.query(
      `INSERT INTO condo_roles (id, condominium_id, user_id, role, resident_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (condominium_id, user_id, role)
       DO UPDATE SET active = TRUE, resident_id = EXCLUDED.resident_id`,
      [randomUUID(), parsed.condominiumId, parsed.userId, parsed.role, parsed.residentId],
    );
  }

  private async inTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
