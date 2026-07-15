import type { CondoSettings } from '../domain/condo-settings';
import type { SettingsRepository } from '../domain/settings-repository';

export async function getSettings(repo: SettingsRepository): Promise<CondoSettings> {
  return repo.get();
}
