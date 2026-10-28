import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import { createTestCondo } from '../../../test-support/condos';
import { resetPg } from '../../../test-support/pg';
import { runResidentRepositoryContract } from '../resident-repository.contract';

import { PostgresResidentRepository } from './resident-repository';

const pool = createPool(process.env.DATABASE_URL ?? '');

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await resetPg(pool);
  await createTestCondo(pool, 'condo-a');
  await createTestCondo(pool, 'condo-b');
});

runResidentRepositoryContract(
  'PostgresResidentRepository',
  async (condominiumId) => new PostgresResidentRepository(pool, condominiumId),
  {
    read: async (apartmentId) => {
      const { rows } = await pool.query<{
        floor: number | null;
        position: number | null;
        block: string | null;
        active: boolean;
      }>('SELECT floor, position, block, active FROM apartments WHERE id = $1', [apartmentId]);
      const row = rows[0];
      if (!row) throw new Error(`apartment not found: ${apartmentId}`);
      return row;
    },
    deactivate: async (apartmentId) => {
      await pool.query('UPDATE apartments SET active = FALSE WHERE id = $1', [apartmentId]);
    },
  },
);
