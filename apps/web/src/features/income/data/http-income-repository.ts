import { z } from 'zod';

import type { ApiClient } from '@/shared/lib/api-client';

import { incomeSchema, type Income, type IncomeDraft } from '../domain/income';
import type { IncomeRepository } from '../domain/income-repository';

const incomeListSchema = z.array(incomeSchema);

export class HttpIncomeRepository implements IncomeRepository {
  constructor(private readonly api: ApiClient) {}

  async list(): Promise<Income[]> {
    return incomeListSchema.parse(await this.api.get('/api/incomes'));
  }

  async save(draft: IncomeDraft): Promise<Income> {
    if (draft.id === undefined) {
      return incomeSchema.parse(await this.api.post('/api/incomes', draft));
    }
    return incomeSchema.parse(await this.api.put(`/api/incomes/${draft.id}`, draft));
  }

  async remove(id: string): Promise<void> {
    await this.api.del(`/api/incomes/${id}`);
  }
}
