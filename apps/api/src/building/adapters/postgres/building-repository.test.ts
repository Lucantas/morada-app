import { randomUUID } from 'node:crypto';

import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import { createTestCondo } from '../../../test-support/condos';
import { resetPg } from '../../../test-support/pg';
import { runBuildingRepositoryContract } from '../building-repository.contract';

import { PostgresBuildingRepository } from './building-repository';

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

runBuildingRepositoryContract(
  'PostgresBuildingRepository',
  async (condominiumId) => new PostgresBuildingRepository(pool, condominiumId),
  {
    occupy: async (apartmentId) => {
      const residentId = randomUUID();
      await pool.query(
        `INSERT INTO residents (id, name, phone, email, status, condominium_id)
         SELECT $1, 'Morador', '', '', 'em_dia', condominium_id FROM apartments WHERE id = $2`,
        [residentId, apartmentId],
      );
      await pool.query(
        'INSERT INTO apartment_residents (id, apartment_id, resident_id, active) VALUES ($1, $2, $3, TRUE)',
        [randomUUID(), apartmentId, residentId],
      );
    },
  },
);
