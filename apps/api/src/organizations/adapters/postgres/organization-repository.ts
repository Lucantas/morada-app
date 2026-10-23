import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

import { OrgCondoNotFoundError, OrganizationNotFoundError } from '../../domain/errors';
import {
  condoIdsSchema,
  orgRoleSchema,
  organizationNameSchema,
  type OrgCondo,
  type OrgMember,
  type Organization,
} from '../../domain/organization';
import type { OrgMembership, OrganizationRepository } from '../../domain/organization-repository';

const organizationRowSchema = z.object({ id: z.string(), name: z.string() });

const memberRowSchema = z.object({
  user_id: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  role: orgRoleSchema,
  active: z.boolean(),
  condo_ids: z.array(z.string()),
});

const membershipRowSchema = z.object({ role: orgRoleSchema, active: z.boolean() });

const MEMBERS_SQL = `
  SELECT m.user_id, u.name, u.email, m.role, m.active,
    COALESCE(
      array_agg(c.id ORDER BY c.id) FILTER (WHERE c.id IS NOT NULL),
      ARRAY[]::text[]
    ) AS condo_ids
  FROM organization_members m
  JOIN users u ON u.id = m.user_id
  LEFT JOIN condo_roles r
    ON r.user_id = m.user_id AND r.role = 'administrador' AND r.active
  LEFT JOIN condominiums c
    ON c.id = r.condominium_id AND c.organization_id = m.organization_id AND c.active
  WHERE m.organization_id = $1
  GROUP BY m.id, m.user_id, u.name, u.email, m.role, m.active
  ORDER BY m.role = 'owner' DESC, m.active DESC, u.name NULLS LAST, m.user_id`;

const DEACTIVATE_ORG_ADMIN_GRANTS = `
  UPDATE condo_roles SET active = FALSE
  WHERE user_id = $2 AND role = 'administrador' AND active
    AND condominium_id IN (SELECT id FROM condominiums WHERE organization_id = $1)`;

function toMember(raw: unknown): OrgMember {
  const row = memberRowSchema.parse(raw);
  return {
    userId: row.user_id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: row.active,
    condoIds: row.condo_ids,
  };
}

export class PostgresOrganizationRepository implements OrganizationRepository {
  constructor(private readonly pool: Pool) {}

  async isActiveOwner(organizationId: string, userId: string): Promise<boolean> {
    const { rows } = await this.pool.query(
      `SELECT 1 FROM organization_members m
       JOIN organizations o ON o.id = m.organization_id AND o.active
       WHERE m.organization_id = $1 AND m.user_id = $2 AND m.role = 'owner' AND m.active`,
      [organizationId, userId],
    );
    return rows.length > 0;
  }

  async get(organizationId: string): Promise<Organization | null> {
    const { rows } = await this.pool.query(
      'SELECT id, name FROM organizations WHERE id = $1 AND active',
      [organizationId],
    );
    return rows[0] ? organizationRowSchema.parse(rows[0]) : null;
  }

  async rename(organizationId: string, name: string): Promise<Organization> {
    const { rows } = await this.pool.query(
      'UPDATE organizations SET name = $2 WHERE id = $1 AND active RETURNING id, name',
      [organizationId, organizationNameSchema.parse(name)],
    );
    if (!rows[0]) throw new OrganizationNotFoundError();
    return organizationRowSchema.parse(rows[0]);
  }

  async members(organizationId: string): Promise<OrgMember[]> {
    const { rows } = await this.pool.query(MEMBERS_SQL, [organizationId]);
    return rows.map(toMember);
  }

  async condos(organizationId: string): Promise<OrgCondo[]> {
    const { rows } = await this.pool.query(
      `SELECT id, name FROM condominiums WHERE organization_id = $1 AND active
       ORDER BY name, id`,
      [organizationId],
    );
    return rows.map((row) => organizationRowSchema.parse(row));
  }

  async member(organizationId: string, userId: string): Promise<OrgMembership | null> {
    const { rows } = await this.pool.query(
      'SELECT role, active FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [organizationId, userId],
    );
    return rows[0] ? membershipRowSchema.parse(rows[0]) : null;
  }

  async deactivateMember(organizationId: string, userId: string): Promise<void> {
    await this.inTransaction(async (client) => {
      await client.query(
        `UPDATE organization_members SET active = FALSE
         WHERE organization_id = $1 AND user_id = $2 AND role = 'member'`,
        [organizationId, userId],
      );
      await client.query(DEACTIVATE_ORG_ADMIN_GRANTS, [organizationId, userId]);
    });
  }

  async assignCondos(
    organizationId: string,
    userId: string,
    condoIds: readonly string[],
  ): Promise<string[]> {
    const wanted = [...new Set(condoIdsSchema.parse(condoIds))].sort();
    return this.inTransaction(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `SELECT id FROM condominiums
         WHERE organization_id = $1 AND active AND id = ANY($2::text[])
         FOR UPDATE`,
        [organizationId, wanted],
      );
      if (rows.length !== wanted.length) throw new OrgCondoNotFoundError();
      await client.query(
        `UPDATE condo_roles SET active = FALSE
         WHERE user_id = $2 AND role = 'administrador' AND active
           AND NOT (condominium_id = ANY($3::text[]))
           AND condominium_id IN (SELECT id FROM condominiums WHERE organization_id = $1)`,
        [organizationId, userId, wanted],
      );
      await client.query(
        `INSERT INTO condo_roles (id, condominium_id, user_id, role, resident_id)
         SELECT gen_random_uuid()::text, c.id, $2, 'administrador', NULL
         FROM condominiums c
         WHERE c.organization_id = $1 AND c.active AND c.id = ANY($3::text[])
         ON CONFLICT (condominium_id, user_id, role)
         DO UPDATE SET active = TRUE, resident_id = NULL`,
        [organizationId, userId, wanted],
      );
      return wanted;
    });
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
