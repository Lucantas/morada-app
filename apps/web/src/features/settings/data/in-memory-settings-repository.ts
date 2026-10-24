import {
  condoSettingsSchema,
  type CondoSettings,
  type CondoSettingsInput,
  type CondoSettingsUpdate,
} from '../domain/condo-settings';
import type { SettingsRepository } from '../domain/settings-repository';

export class InMemorySettingsRepository implements SettingsRepository {
  private current: CondoSettings;

  constructor(initial: CondoSettingsInput) {
    this.current = condoSettingsSchema.parse(initial);
  }

  async get(): Promise<CondoSettings> {
    return this.current;
  }

  async save(settings: CondoSettingsUpdate): Promise<CondoSettings> {
    this.current = condoSettingsSchema.parse({
      ...settings,
      pix: settings.pix === undefined ? this.current.pix : settings.pix,
    });
    return this.current;
  }

  snapshot(): CondoSettings {
    return this.current;
  }
}
