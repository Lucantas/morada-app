import { z } from 'zod';

import type { ApiClient } from '@/shared/lib/api-client';
import { ApiError } from '@/shared/lib/api-client';

import { accountSchema, type Account } from '../domain/account';
import type { AccountRepository } from '../domain/account-repository';

const accountListSchema = z.array(accountSchema);

export class HttpAccountRepository implements AccountRepository {
  constructor(private readonly api: ApiClient) {}

  async list(): Promise<Account[]> {
    return accountListSchema.parse(await this.api.get('/api/accounts'));
  }

  async getById(id: string): Promise<Account | null> {
    try {
      return accountSchema.parse(await this.api.get(`/api/accounts/${id}`));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  async save(account: Account): Promise<Account> {
    // PUT upserts by the (client-generated) id, so create and update share a path.
    return accountSchema.parse(await this.api.put(`/api/accounts/${account.id}`, account));
  }
}
