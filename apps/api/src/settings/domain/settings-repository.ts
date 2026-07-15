import type { CondoSettings } from './condo-settings';

export interface SettingsRepository {
  get(): Promise<CondoSettings>;
  save(settings: CondoSettings): Promise<CondoSettings>;
}
