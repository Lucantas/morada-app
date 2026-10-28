import type { ApiClient } from '@/shared/lib/api-client';

import { streetSchema, type Street } from '../domain/street';
import type { StreetRepository } from '../domain/street-repository';

export class HttpStreetRepository implements StreetRepository {
  constructor(private readonly api: ApiClient) {}

  async get(): Promise<Street> {
    return streetSchema.parse(await this.api.get('/me/street'));
  }
}
