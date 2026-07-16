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
