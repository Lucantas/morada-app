import type { CondoSettings, CondoSettingsUpdate } from './condo-settings';

export interface SettingsRepository {
  get(): Promise<CondoSettings>;
  save(settings: CondoSettingsUpdate): Promise<CondoSettings>;
}
