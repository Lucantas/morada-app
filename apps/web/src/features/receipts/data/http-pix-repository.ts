import type { ApiClient } from '@/shared/lib/api-client';

import { pixInfoSchema, type PixInfo } from '../domain/pix-info';
import type { PixRepository } from '../domain/pix-repository';

export class HttpPixRepository implements PixRepository {
  constructor(private readonly api: ApiClient) {}

  async get(): Promise<PixInfo> {
    return pixInfoSchema.parse(await this.api.get('/api/pix'));
  }
}
