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
