import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import { resetPg } from '../../../test-support/pg';
import {
  runAuthTokenRepositoryContract,
  CONTRACT_USER_ID,
} from '../auth-token-repository.contract';

import { PostgresAuthTokenRepository } from './auth-token-repository';
import { PostgresUserRepository } from './user-repository';

const pool = createPool(process.env.DATABASE_URL ?? '');

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

runAuthTokenRepositoryContract('PostgresAuthTokenRepository', async () => {
  await resetPg(pool);
  await new PostgresUserRepository(pool).save({
    id: CONTRACT_USER_ID,
    username: null,
    email: 'token@x.com',
    name: 'Token',
    passwordHash: 'hash',
    role: 'admin',
    residentId: null,
    emailVerifiedAt: null,
  });
  return new PostgresAuthTokenRepository(pool);
});
