import type { ProofBytes } from '../../receipts/domain/proof-storage';

import type { Account } from './account';

export interface AccountRepository {
  list(): Promise<Account[]>;
  getById(id: string): Promise<Account | null>;
  save(account: Account): Promise<Account>;
  archive(id: string): Promise<void>;
  getProof(id: string): Promise<ProofBytes | null>;
}
