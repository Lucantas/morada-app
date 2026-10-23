import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import { createTestCondo } from '../../../test-support/condos';
import { resetPg } from '../../../test-support/pg';
import {
  CONTRACT_ADMIN_ID,
  CONTRACT_CLAIMER_ID,
  CONTRACT_RESIDENT_A,
  CONTRACT_RESIDENT_B,
  runInvitationRepositoryContract,
} from '../invitation-repository.contract';

import {
  PostgresInvitationRepository,
  PostgresInvitationTokenRepository,
} from './invitation-repository';

const pool = createPool(process.env.DATABASE_URL ?? '');

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

async function insertUser(id: string): Promise<void> {
  await pool.query(
    `INSERT INTO users (id, username, password_hash, role) VALUES ($1, $1, 'x', 'admin')`,
    [id],
  );
}

async function insertResident(id: string, condominiumId: string): Promise<void> {
  await pool.query(
    `INSERT INTO residents (id, name, phone, email, status, condominium_id)
     VALUES ($1, 'Fulano', '', '', 'em_dia', $2)`,
    [id, condominiumId],
  );
}

beforeEach(async () => {
  await resetPg(pool);
  await createTestCondo(pool, 'condo-a');
  await createTestCondo(pool, 'condo-b');
  await insertUser(CONTRACT_ADMIN_ID);
  await insertUser(CONTRACT_CLAIMER_ID);
  await insertResident(CONTRACT_RESIDENT_A, 'condo-a');
  await insertResident(CONTRACT_RESIDENT_B, 'condo-b');
});

runInvitationRepositoryContract('PostgresInvitationRepository', async (condominiumId) => ({
  invitations: new PostgresInvitationRepository(pool, condominiumId),
  tokens: new PostgresInvitationTokenRepository(pool),
}));

async function waitForLockWait(): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const { rows } = await pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND datname = current_database()",
    );
    if ((rows[0]?.n ?? 0) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('create never waited on the pending invitation lock');
}

test('a create racing another pending invitation answers 409 Já existe um convite pendente', async () => {
  const racer = await pool.connect();
  try {
    await racer.query('BEGIN');
    await racer.query(
      `INSERT INTO invitations (id, condominium_id, resident_id, role, email, token_hash, status, expires_at, created_by)
       VALUES ('inv-racer', 'condo-a', $1, 'morador', NULL, 'h-racer', 'pendente', now() + interval '1 day', $2)`,
      [CONTRACT_RESIDENT_A, CONTRACT_ADMIN_ID],
    );
    const repo = new PostgresInvitationRepository(pool, 'condo-a');
    const pending = repo
      .create({
        residentId: CONTRACT_RESIDENT_A,
        email: null,
        tokenHash: 'h-late',
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
        createdBy: CONTRACT_ADMIN_ID,
      })
      .catch((error: unknown) => error);
    await waitForLockWait();
    await racer.query('COMMIT');

    expect(await pending).toMatchObject({ status: 409, message: 'Já existe um convite pendente' });
  } finally {
    racer.release();
  }
  const { rows } = await pool.query("SELECT id FROM invitations WHERE status = 'pendente'");
  expect(rows).toEqual([{ id: 'inv-racer' }]);
});

const FUTURE = new Date('2099-01-01T00:00:00.000Z');

test('a membro invitation reads back with its organization and org role', async () => {
  await pool.query(
    `INSERT INTO invitations (id, organization_id, org_role, role, email, token_hash, status, expires_at, created_by)
     VALUES ('inv-membro', 'org-condo-a', 'member', 'membro', 'equipe@x.com', 'h-membro', 'pendente', $1, $2)`,
    [FUTURE, CONTRACT_ADMIN_ID],
  );
  const tokens = new PostgresInvitationTokenRepository(pool);

  const found = await tokens.findByTokenHash('h-membro', new Date('2026-10-23T12:00:00.000Z'));

  expect(found).toMatchObject({
    id: 'inv-membro',
    role: 'membro',
    organizationId: 'org-condo-a',
    orgRole: 'member',
    email: 'equipe@x.com',
    status: 'pendente',
  });
  expect(found).not.toHaveProperty('condominiumId');
});

test.each([
  ['a sindico without an e-mail', "'condo-a', NULL, NULL, 'sindico', NULL"],
  ['a sindico tied to a resident', "'condo-a', 'r-a', NULL, 'sindico', 's@x.com'"],
  ['a membro tied to a condominium', "'condo-a', NULL, 'org-condo-a', 'membro', 'm@x.com'"],
  ['a membro without an org role', "NULL, NULL, 'org-condo-a', 'membro', 'm@x.com'"],
  ['a morador without a resident', "'condo-a', NULL, NULL, 'morador', 'm@x.com'"],
])('the database refuses %s', async (_label, values) => {
  await expect(
    pool.query(
      `INSERT INTO invitations (id, condominium_id, resident_id, organization_id, role, email, token_hash, status, expires_at, created_by)
       VALUES ('inv-bad', ${values}, 'h-bad', 'pendente', $1, $2)`,
      [FUTURE, CONTRACT_ADMIN_ID],
    ),
  ).rejects.toMatchObject({ code: '23514' });
});

test('only one pending sindico invitation per condominium is stored', async () => {
  const insert = (id: string) =>
    pool.query(
      `INSERT INTO invitations (id, condominium_id, role, email, token_hash, status, expires_at, created_by)
       VALUES ($1, 'condo-a', 'sindico', 's@x.com', $1, 'pendente', $2, $3)`,
      [id, FUTURE, CONTRACT_ADMIN_ID],
    );
  await insert('inv-s1');

  await expect(insert('inv-s2')).rejects.toMatchObject({
    code: '23505',
    constraint: 'idx_invitations_one_pending_sindico',
  });
});
