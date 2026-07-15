import { condoSettingsSchema, type CondoSettings } from '../domain/condo-settings';
import { SettingsValidationError } from '../domain/errors';
import type { SettingsRepository } from '../domain/settings-repository';

export async function updateSettings(
  repo: SettingsRepository,
  input: unknown,
): Promise<CondoSettings> {
  const parsed = condoSettingsSchema.safeParse(input);
  if (!parsed.success) throw new SettingsValidationError('Configurações inválidas');
  return repo.save(parsed.data);
}
