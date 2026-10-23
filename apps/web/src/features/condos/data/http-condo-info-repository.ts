import type { ApiClient } from '@/shared/lib/api-client';

import { condoInfoSchema, condoNameSchema, type CondoInfo } from '../domain/condo-info';
import type { CondoInfoRepository } from '../domain/condo-info-repository';

export class HttpCondoInfoRepository implements CondoInfoRepository {
  constructor(private readonly api: ApiClient) {}

  async get(): Promise<CondoInfo> {
    return condoInfoSchema.parse(await this.api.get('/api/info'));
  }

  async rename(name: string): Promise<CondoInfo> {
    return condoInfoSchema.parse(
      await this.api.put('/api/info', { name: condoNameSchema.parse(name) }),
    );
  }
}
