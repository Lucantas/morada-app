import { condoSettingsSchema, type CondoSettings } from '../domain/condo-settings';
import type { SettingsRepository } from '../domain/settings-repository';

export class InMemorySettingsRepository implements SettingsRepository {
  private current: CondoSettings;

  constructor(initial: CondoSettings) {
    this.current = condoSettingsSchema.parse(initial);
  }

  async get(): Promise<CondoSettings> {
    return this.current;
  }

  async save(settings: CondoSettings): Promise<CondoSettings> {
    this.current = condoSettingsSchema.parse(settings);
    return this.current;
  }

  snapshot(): CondoSettings {
    return this.current;
  }
}
