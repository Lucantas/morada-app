import { createTestDb } from '../../../platform/db';
import { runUserRepositoryContract } from '../user-repository.contract';

import { SqliteUserRepository } from './user-repository';

runUserRepositoryContract(
  'SqliteUserRepository',
  async () => new SqliteUserRepository(createTestDb()),
);
