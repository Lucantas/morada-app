import type { ApiClient } from '@/shared/lib/api-client';

import { condoSettingsSchema, type CondoSettings } from '../domain/condo-settings';
import type { SettingsRepository } from '../domain/settings-repository';

export class HttpSettingsRepository implements SettingsRepository {
  constructor(private readonly api: ApiClient) {}

  async get(): Promise<CondoSettings> {
    return condoSettingsSchema.parse(await this.api.get('/api/settings'));
  }

  async save(settings: CondoSettings): Promise<CondoSettings> {
    return condoSettingsSchema.parse(await this.api.put('/api/settings', settings));
  }
}
