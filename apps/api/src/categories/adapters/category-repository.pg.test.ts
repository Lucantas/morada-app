import { migrate } from '../../platform/postgres/migrate';
import { createPool } from '../../platform/postgres/pool';
import { createTestCondo } from '../../test-support/condos';
import { insertRows, resetPg } from '../../test-support/pg';
import { runCategoryRepositoryContract } from './category-repository.contract';

import { PostgresCategoryRepository } from './postgres/category-repository';

const pool = createPool(process.env.DATABASE_URL ?? '');

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

describe('PostgresCategoryRepository — contract', () => {
  beforeEach(async () => {
    await resetPg(pool);
    await createTestCondo(pool, 'condo-a');
    await createTestCondo(pool, 'condo-b');
    await insertRows(
      pool,
      'categories',
      ['id', 'name', 'keywords', 'position', 'condominium_id'],
      [
        {
          id: 'cat-agua',
          name: 'Água',
          keywords: 'água, agua, saneamento, esgoto',
          position: 0,
          condominium_id: 'condo-a',
        },
        {
          id: 'cat-energia',
          name: 'Energia',
          keywords: 'energia, luz, elétr, eletr',
          position: 1,
          condominium_id: 'condo-a',
        },
        {
          id: 'cat-servicos',
          name: 'Serviços',
          keywords: 'limpeza, internet, portaria, serviço, servico, segurança',
          position: 2,
          condominium_id: 'condo-a',
        },
        {
          id: 'cat-manutencao',
          name: 'Manutenção',
          keywords: 'manutenção, manutencao, reparo, elevador, conserto, bomba',
          position: 3,
          condominium_id: 'condo-a',
        },
      ],
    );
  });

  runCategoryRepositoryContract(
    'PostgresCategoryRepository',
    async (condominiumId) => new PostgresCategoryRepository(pool, condominiumId),
  );
});

describe('PostgresCategoryRepository.replaceAll atomicity', () => {
  test('rolls back account updates when a category insert fails', async () => {
    await resetPg(pool);
    await insertRows(
      pool,
      'accounts',
      ['id', 'description', 'category', 'date', 'value_cents', 'status'],
      [
        {
          id: 'acc-1',
          description: 'Conta de luz',
          category: 'Energia',
          date: '2026-07-01',
          value_cents: 1000,
          status: 'pendente',
        },
      ],
    );
    const repo = new PostgresCategoryRepository(pool, 'condo-legacy');
    const validCategory = { id: 'cat-a', name: 'A', keywords: 'a', position: 0 };

    await expect(
      repo.replaceAll(
        [validCategory, { ...validCategory }],
        [{ id: 'acc-1', category: 'NovaCat' }],
      ),
    ).rejects.toThrow();

    const { rows } = await pool.query('SELECT category FROM accounts WHERE id = $1', ['acc-1']);
    expect(rows[0].category).not.toBe('NovaCat');
  });

  test("replaceAll only reclassifies the condo's own accounts", async () => {
    await resetPg(pool);
    await createTestCondo(pool, 'condo-a');
    await createTestCondo(pool, 'condo-b');
    const columns = ['id', 'description', 'category', 'date', 'value_cents', 'status'];
    const account = { description: 'Conta', category: 'Antiga', date: '2026-07-01' };
    await insertRows(
      pool,
      'accounts',
      [...columns, 'condominium_id'],
      [
        { ...account, id: 'acc-a', value_cents: 1, status: 'pendente', condominium_id: 'condo-a' },
        { ...account, id: 'acc-b', value_cents: 1, status: 'pendente', condominium_id: 'condo-b' },
      ],
    );

    await new PostgresCategoryRepository(pool, 'condo-a').replaceAll(
      [{ id: 'cat-a', name: 'A', keywords: 'a', position: 0 }],
      [
        { id: 'acc-a', category: 'Nova' },
        { id: 'acc-b', category: 'Nova' },
      ],
    );

    const { rows } = await pool.query('SELECT id, category FROM accounts ORDER BY id');
    expect(rows).toEqual([
      { id: 'acc-a', category: 'Nova' },
      { id: 'acc-b', category: 'Antiga' },
    ]);
  });
});
