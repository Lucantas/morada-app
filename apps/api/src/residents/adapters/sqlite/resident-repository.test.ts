import { createTestDb } from '../../../platform/db';
import { runResidentRepositoryContract } from '../resident-repository.contract';

import { SqliteResidentRepository } from './resident-repository';

runResidentRepositoryContract(
  'SqliteResidentRepository',
  async () => new SqliteResidentRepository(createTestDb()),
);
