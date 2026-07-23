import type { Account } from '../domain/account';
import type { AccountRepository } from '../domain/account-repository';

import { toAccount } from './account-row';

export class InMemoryAccountRepository implements AccountRepository {
  private accounts: Map<string, Account>;

  constructor(seed: readonly unknown[] = []) {
    this.accounts = new Map(seed.map((raw) => toAccount(raw)).map((a) => [a.id, a]));
  }

  async list(): Promise<Account[]> {
    return [...this.accounts.values()];
  }

  async getById(id: string): Promise<Account | null> {
    return this.accounts.get(id) ?? null;
  }

  async save(account: Account): Promise<Account> {
    const existing = this.accounts.get(account.id);
    const hasProof =
      account.proofDataUrl === undefined
        ? (existing?.hasProof ?? false)
        : account.proofDataUrl !== null;
    const stored: Account = { ...account, proofDataUrl: undefined, hasProof };
    this.accounts = new Map(this.accounts).set(stored.id, stored);
    return stored;
  }

  async archive(id: string): Promise<void> {
    const next = new Map(this.accounts);
    next.delete(id);
    this.accounts = next;
  }
}
