import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import { createTestCondo } from '../../../test-support/condos';
import { resetPg } from '../../../test-support/pg';
import { runThreadRepositoryContract } from '../thread-repository.contract';

import { PostgresThreadRepository } from './thread-repository';

const pool = createPool(process.env.DATABASE_URL ?? '');

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

async function createViewer(id: string): Promise<void> {
  await pool.query(
    "INSERT INTO users (id, username, password_hash, role) VALUES ($1, $1, 'x', 'admin')",
    [id],
  );
}

describe('PostgresThreadRepository — contract', () => {
  beforeEach(async () => {
    await resetPg(pool);
    await createTestCondo(pool, 'condo-a');
    await createTestCondo(pool, 'condo-b');
    await createViewer('u-a');
    await createViewer('u-b');
  });

  runThreadRepositoryContract(
    'PostgresThreadRepository',
    async (condominiumId) => new PostgresThreadRepository(pool, condominiumId),
    { a: 'u-a', b: 'u-b' },
  );
});
