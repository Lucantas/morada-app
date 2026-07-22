import { migrate } from '../../platform/postgres/migrate';
import { createPool } from '../../platform/postgres/pool';
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

runCategoryRepositoryContract('PostgresCategoryRepository', async () => {
  await resetPg(pool);
  await insertRows(
    pool,
    'categories',
    ['id', 'name', 'keywords', 'position'],
    [
      { id: 'cat-agua', name: 'Água', keywords: 'água, agua, saneamento, esgoto', position: 0 },
      { id: 'cat-energia', name: 'Energia', keywords: 'energia, luz, elétr, eletr', position: 1 },
      {
        id: 'cat-servicos',
        name: 'Serviços',
        keywords: 'limpeza, internet, portaria, serviço, servico, segurança',
        position: 2,
      },
      {
        id: 'cat-manutencao',
        name: 'Manutenção',
        keywords: 'manutenção, manutencao, reparo, elevador, conserto, bomba',
        position: 3,
      },
    ],
  );
  return new PostgresCategoryRepository(pool);
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
    const repo = new PostgresCategoryRepository(pool);
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
});
