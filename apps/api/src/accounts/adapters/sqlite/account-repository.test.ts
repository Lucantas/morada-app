import { createTestDb } from '../../../platform/db';
import { runAccountRepositoryContract } from '../account-repository.contract';

import { SqliteAccountRepository } from './account-repository';

runAccountRepositoryContract(
  'SqliteAccountRepository',
  async () => new SqliteAccountRepository(createTestDb()),
);
