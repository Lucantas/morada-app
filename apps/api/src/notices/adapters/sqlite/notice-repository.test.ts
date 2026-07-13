import { createTestDb } from '../../../platform/db';
import { runNoticeRepositoryContract } from '../notice-repository.contract';

import { SqliteNoticeRepository } from './notice-repository';

runNoticeRepositoryContract(
  'SqliteNoticeRepository',
  async () => new SqliteNoticeRepository(createTestDb()),
);
