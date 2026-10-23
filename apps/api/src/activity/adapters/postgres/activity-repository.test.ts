import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import { createTestCondo } from '../../../test-support/condos';
import { resetPg } from '../../../test-support/pg';
import { runActivityRepositoryContract } from '../activity-repository.contract';

import { PostgresActivityRepository } from './activity-repository';

const pool = createPool(process.env.DATABASE_URL ?? '');

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

describe('PostgresActivityRepository — contract', () => {
  beforeEach(async () => {
    await resetPg(pool);
    await createTestCondo(pool, 'condo-a');
    await createTestCondo(pool, 'condo-b');
  });

  runActivityRepositoryContract(
    'PostgresActivityRepository',
    async (condominiumId) => new PostgresActivityRepository(pool, condominiumId),
    async (user) => {
      await pool.query(
        `INSERT INTO users (id, username, email, name, password_hash, role)
         VALUES ($1, $2, $3, $4, 'x', 'resident')`,
        [user.id, user.username ?? `login-${user.id}`, user.email, user.name],
      );
    },
  );
});
