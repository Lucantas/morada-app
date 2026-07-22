import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import { insertRows, resetPg } from '../../../test-support/pg';
import { MonthlyReceiptExistsError } from '../../domain/errors';
import { runReceiptRepositoryContract } from '../receipt-repository.contract';

import { PostgresReceiptRepository } from './receipt-repository';

const pool = createPool(process.env.DATABASE_URL ?? '');

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

runReceiptRepositoryContract('PostgresReceiptRepository', async () => {
  await resetPg(pool);
  return new PostgresReceiptRepository(pool);
});

describe('PostgresReceiptRepository — monthly condo-fee uniqueness', () => {
  const RECEIPT_COLUMNS = [
    'id',
    'ref',
    'title',
    'due_date',
    'value_cents',
    'status',
    'resident_id',
  ];

  beforeEach(async () => {
    await resetPg(pool);
  });

  test('migration archives duplicate visible condo-fee receipts, keeping the pago one', async () => {
    // The unique index (already applied in beforeAll) forbids seeding two
    // visible duplicates directly, so this drops the index, seeds the
    // pre-migration duplicate state, then reruns the exact dedupe step the
    // migration performs before recreating the index — proving the ranking
    // rule (pago > em_analise > rest, tie-break lowest id) end to end.
    await pool.query('DROP INDEX idx_receipts_condo_fee_month');
    await insertRows(pool, 'receipts', RECEIPT_COLUMNS, [
      {
        id: 'dup-pendente',
        ref: '07/2026',
        title: 'Taxa condominial',
        due_date: '2026-07-15',
        value_cents: 15000,
        status: 'pendente',
        resident_id: 'r-1',
      },
      {
        id: 'dup-pago',
        ref: '07/2026',
        title: 'Taxa condominial',
        due_date: '2026-07-15',
        value_cents: 15000,
        status: 'pago',
        resident_id: 'r-1',
      },
    ]);

    await pool.query(`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY resident_id, ref
                 ORDER BY
                   CASE status WHEN 'pago' THEN 0 WHEN 'em_analise' THEN 1 ELSE 2 END,
                   id
               ) AS rn
        FROM receipts
        WHERE visible AND title = 'Taxa condominial'
      )
      UPDATE receipts SET visible = false
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
    `);
    await pool.query(`
      CREATE UNIQUE INDEX idx_receipts_condo_fee_month
        ON receipts (resident_id, ref) WHERE visible AND title = 'Taxa condominial'
    `);

    const repo = new PostgresReceiptRepository(pool);
    expect(await repo.getById('dup-pago')).not.toBeNull();
    expect(await repo.getById('dup-pendente')).toBeNull();
  });

  test('the partial unique index blocks a second visible condo-fee receipt for the same resident/month', async () => {
    await insertRows(pool, 'receipts', RECEIPT_COLUMNS, [
      {
        id: 'first',
        ref: '07/2026',
        title: 'Taxa condominial',
        due_date: '2026-07-15',
        value_cents: 15000,
        status: 'pendente',
        resident_id: 'r-1',
      },
    ]);

    await expect(
      pool.query(
        `INSERT INTO receipts (${RECEIPT_COLUMNS.join(', ')}) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ['second', '07/2026', 'Taxa condominial', '2026-07-15', 15000, 'pendente', 'r-1'],
      ),
    ).rejects.toMatchObject({ code: '23505', constraint: 'idx_receipts_condo_fee_month' });
  });

  test('save throws MonthlyReceiptExistsError when it collides with the unique index', async () => {
    const repo = new PostgresReceiptRepository(pool);
    await repo.save({
      id: 'first',
      ref: '07/2026',
      title: 'Taxa condominial',
      dueDate: '2026-07-15',
      valueCents: 15000,
      status: 'pendente',
      residentId: 'r-1',
    });

    await expect(
      repo.save({
        id: 'second',
        ref: '07/2026',
        title: 'Taxa condominial',
        dueDate: '2026-07-15',
        valueCents: 15000,
        status: 'pendente',
        residentId: 'r-1',
      }),
    ).rejects.toThrow(MonthlyReceiptExistsError);
  });
});
