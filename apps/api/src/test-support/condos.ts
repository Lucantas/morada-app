import type { Pool } from 'pg';

interface TestCondoOptions {
  name?: string;
  orgId?: string;
}

export async function createTestCondo(
  pool: Pool,
  id: string,
  opts: TestCondoOptions = {},
): Promise<void> {
  const orgId = opts.orgId ?? `org-${id}`;
  await pool.query(
    'INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
    [orgId, `Organização ${orgId}`],
  );
  await pool.query(
    'INSERT INTO condominiums (id, organization_id, name, onboarded_at) VALUES ($1, $2, $3, now())',
    [id, orgId, opts.name ?? `Condomínio ${id}`],
  );
  await pool.query(
    'INSERT INTO condo_settings (condominium_id, monthly_fee_cents, due_day) VALUES ($1, 15000, 15)',
    [id],
  );
}
