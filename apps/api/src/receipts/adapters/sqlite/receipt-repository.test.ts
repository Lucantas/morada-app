import { createTestDb } from '../../../platform/db';
import { runReceiptRepositoryContract } from '../receipt-repository.contract';

import { SqliteReceiptRepository } from './receipt-repository';

runReceiptRepositoryContract(
  'SqliteReceiptRepository',
  async () => new SqliteReceiptRepository(createTestDb()),
);
