import { createTestDb } from '../../../platform/db';
import { runThreadRepositoryContract } from '../thread-repository.contract';

import { SqliteThreadRepository } from './thread-repository';

runThreadRepositoryContract(
  'SqliteThreadRepository',
  async () => new SqliteThreadRepository(createTestDb()),
);
