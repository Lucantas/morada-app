import { Pool } from 'pg';

import { createTestCondo } from '../../test-support/condos';
import { insertRows } from '../../test-support/pg';

import { migrate, migrateTo } from './migrate';

const SCHEMA = 'migration_test';
const LAST_LEGACY_MIGRATION = '014_account_proof';
const SCOPED_TABLES = [
  'apartments',
  'residents',
  'accounts',
  'receipts',
  'notices',
  'threads',
  'categories',
  'incomes',
  'condo_settings',
];

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? '',
  options: `-c search_path=${SCHEMA}`,
});

async function recreateSchema(): Promise<void> {
  await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await pool.query(`CREATE SCHEMA ${SCHEMA}`);
}

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${sql}`, params);
  return rows[0]?.n ?? -1;
}

async function seedLegacyData(): Promise<void> {
  await insertRows(pool, 'apartments', ['id', 'label'], [{ id: 'apt-302', label: 'Apto 302' }]);
  await insertRows(
    pool,
    'residents',
    ['id', 'name', 'phone', 'email', 'status'],
    [{ id: 'res-lucia', name: 'Lúcia', phone: '11999990000', email: 'l@x.com', status: 'pago' }],
  );
  await insertRows(
    pool,
    'apartment_residents',
    ['id', 'apartment_id', 'resident_id', 'active'],
    [{ id: 'occ-1', apartment_id: 'apt-302', resident_id: 'res-lucia', active: true }],
  );
  await insertRows(
    pool,
    'users',
    ['id', 'username', 'password_hash', 'role', 'resident_id'],
    [
      { id: 'u-admin', username: 'admin', password_hash: 'h1', role: 'admin', resident_id: null },
      {
        id: 'u-lucia',
        username: 'lucia302',
        password_hash: 'h2',
        role: 'resident',
        resident_id: 'res-lucia',
      },
    ],
  );
  await insertRows(
    pool,
    'accounts',
    ['id', 'description', 'category', 'value_cents', 'status', 'date'],
    [
      {
        id: 'acc-1',
        description: 'Conta de água',
        category: 'Água',
        value_cents: 12000,
        status: 'pago',
        date: '2026-09-10',
      },
    ],
  );
  await insertRows(
    pool,
    'receipts',
    ['id', 'ref', 'title', 'value_cents', 'status', 'resident_id', 'apartment_id', 'due_date'],
    [
      {
        id: 'rec-1',
        ref: '2026-09',
        title: 'Taxa condominial',
        value_cents: 15000,
        status: 'pendente',
        resident_id: 'res-lucia',
        apartment_id: 'apt-302',
        due_date: '2026-09-15',
      },
    ],
  );
  await insertRows(
    pool,
    'notices',
    ['id', 'title', 'body', 'kind', 'audience', 'date_label'],
    [
      {
        id: 'not-1',
        title: 'Obra',
        body: 'Elevador',
        kind: 'aviso',
        audience: 'todos',
        date_label: 'hoje',
      },
    ],
  );
  await insertRows(
    pool,
    'notice_dismissals',
    ['notice_id', 'resident_id'],
    [{ notice_id: 'not-1', resident_id: 'res-lucia' }],
  );
  await insertRows(
    pool,
    'threads',
    ['id', 'resident_name', 'apt', 'unread', 'messages'],
    [{ id: 'res-lucia', resident_name: 'Lúcia', apt: 'Apto 302', unread: true, messages: '[]' }],
  );
  await insertRows(
    pool,
    'incomes',
    ['id', 'description', 'source', 'value_cents', 'date'],
    [
      {
        id: 'inc-1',
        description: 'Aluguel salão',
        source: 'salão',
        value_cents: 5000,
        date: '2026-09-05',
      },
    ],
  );
  await pool.query(
    "UPDATE condo_settings SET monthly_fee_cents = 23000, due_day = 10 WHERE id = 'default'",
  );
}

afterAll(async () => {
  await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await pool.end();
});

describe('migrating a database that holds legacy single-condominium data', () => {
  const countsBefore = new Map<string, number>();

  beforeAll(async () => {
    await recreateSchema();
    await migrateTo(pool, LAST_LEGACY_MIGRATION);
    await seedLegacyData();
    for (const table of SCOPED_TABLES) {
      countsBefore.set(table, await count(table));
    }
    await migrate(pool);
  });

  test('015 backfills every operational row into condo-legacy', async () => {
    for (const table of SCOPED_TABLES) {
      expect({ table, n: await count(`${table} WHERE condominium_id = 'condo-legacy'`) }).toEqual({
        table,
        n: countsBefore.get(table),
      });
      expect({ table, n: await count(`${table} WHERE condominium_id IS NULL`) }).toEqual({
        table,
        n: 0,
      });
    }
    expect(countsBefore.get('apartments')).toBe(1);
  });

  test('015 keeps condo settings values under condo-legacy', async () => {
    const { rows } = await pool.query(
      "SELECT monthly_fee_cents, due_day FROM condo_settings WHERE condominium_id = 'condo-legacy'",
    );

    expect(rows).toEqual([{ monthly_fee_cents: 23000, due_day: 10 }]);
  });

  test('015 grants the legacy admin owner + administrador and residents morador', async () => {
    const members = await pool.query(
      'SELECT organization_id, user_id, role, active FROM organization_members',
    );
    const roles = await pool.query(
      'SELECT condominium_id, user_id, role, resident_id, active FROM condo_roles ORDER BY user_id',
    );

    expect(members.rows).toEqual([
      { organization_id: 'org-legacy', user_id: 'u-admin', role: 'owner', active: true },
    ]);
    expect(roles.rows).toEqual([
      {
        condominium_id: 'condo-legacy',
        user_id: 'u-admin',
        role: 'administrador',
        resident_id: null,
        active: true,
      },
      {
        condominium_id: 'condo-legacy',
        user_id: 'u-lucia',
        role: 'morador',
        resident_id: 'res-lucia',
        active: true,
      },
    ]);
  });

  test('016 links threads to resident and apartment', async () => {
    const { rows } = await pool.query(
      "SELECT resident_id, apartment_id FROM threads WHERE id = 'res-lucia'",
    );

    expect(rows).toEqual([{ resident_id: 'res-lucia', apartment_id: 'apt-302' }]);
  });

  test('017 adds a nullable due date to accounts', async () => {
    const { rows } = await pool.query("SELECT due_date FROM accounts WHERE id = 'acc-1'");

    expect(rows).toEqual([{ due_date: null }]);
  });

  test('018 drops the condominium_id default of every scoped table', async () => {
    const { rows } = await pool.query<{ table_name: string; column_default: string | null }>(
      `SELECT table_name, column_default FROM information_schema.columns
       WHERE table_schema = $1 AND column_name = 'condominium_id' AND table_name = ANY($2)
       ORDER BY table_name`,
      [SCHEMA, SCOPED_TABLES],
    );

    expect(rows).toEqual(
      [...SCOPED_TABLES].sort().map((table_name) => ({ table_name, column_default: null })),
    );
  });
});

describe('migrating an empty database', () => {
  beforeAll(async () => {
    await recreateSchema();
  });

  test('migrating an empty database still succeeds', async () => {
    await migrate(pool);

    expect(await count("condominiums WHERE id = 'condo-legacy'")).toBe(1);
    for (const table of [
      'apartments',
      'residents',
      'accounts',
      'receipts',
      'notices',
      'threads',
      'incomes',
    ]) {
      expect({ table, n: await count(table) }).toEqual({ table, n: 0 });
    }
    expect(await count('organization_members')).toBe(0);
    expect(await count('condo_roles')).toBe(0);
  });

  test('apartment labels are unique per condominium, not globally', async () => {
    await createTestCondo(pool, 'condo-b', { name: 'Condomínio B' });
    const insertApartment = (id: string, condominiumId: string) =>
      pool.query('INSERT INTO apartments (id, label, condominium_id) VALUES ($1, $2, $3)', [
        id,
        'Apto 101',
        condominiumId,
      ]);

    await insertApartment('apt-a', 'condo-legacy');
    await insertApartment('apt-b', 'condo-b');

    await expect(insertApartment('apt-a2', 'condo-legacy')).rejects.toMatchObject({
      code: '23505',
    });
  });

  test('createTestCondo seeds the condo with its organization and settings', async () => {
    await createTestCondo(pool, 'condo-c', { orgId: 'org-c' });
    await createTestCondo(pool, 'condo-d', { orgId: 'org-c' });

    const condos = await pool.query(
      "SELECT id, organization_id FROM condominiums WHERE id IN ('condo-c', 'condo-d') ORDER BY id",
    );
    const settings = await pool.query(
      "SELECT monthly_fee_cents, due_day FROM condo_settings WHERE condominium_id = 'condo-c'",
    );

    expect(condos.rows).toEqual([
      { id: 'condo-c', organization_id: 'org-c' },
      { id: 'condo-d', organization_id: 'org-c' },
    ]);
    expect(settings.rows).toEqual([{ monthly_fee_cents: 15000, due_day: 15 }]);
  });
});

describe('023 keeps one pending invitation per resident', () => {
  beforeAll(async () => {
    await recreateSchema();
    await migrateTo(pool, '022_invitations');
    await pool.query(
      "INSERT INTO users (id, username, password_hash, role) VALUES ('u-admin', 'admin', 'x', 'admin')",
    );
    await pool.query(
      "INSERT INTO residents (id, name, phone, email, status, condominium_id) VALUES ('r-1', 'Lúcia', '', '', 'em_dia', 'condo-legacy')",
    );
    for (const [id, createdAt] of [
      ['inv-old', '2026-10-01T00:00:00Z'],
      ['inv-new', '2026-10-02T00:00:00Z'],
    ]) {
      await pool.query(
        `INSERT INTO invitations (id, condominium_id, resident_id, role, token_hash, status, expires_at, created_by, created_at)
         VALUES ($1, 'condo-legacy', 'r-1', 'morador', $1, 'pendente', '2099-01-01', 'u-admin', $2)`,
        [id, createdAt],
      );
    }
    await migrate(pool);
  });

  test('revokes the older duplicates and keeps the newest pending', async () => {
    const { rows } = await pool.query('SELECT id, status FROM invitations ORDER BY id');

    expect(rows).toEqual([
      { id: 'inv-new', status: 'pendente' },
      { id: 'inv-old', status: 'revogado' },
    ]);
  });

  test('a second pending invitation for the same resident is rejected', async () => {
    await expect(
      pool.query(
        `INSERT INTO invitations (id, condominium_id, resident_id, role, token_hash, status, expires_at, created_by)
         VALUES ('inv-dup', 'condo-legacy', 'r-1', 'morador', 'inv-dup', 'pendente', '2099-01-01', 'u-admin')`,
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });
});
