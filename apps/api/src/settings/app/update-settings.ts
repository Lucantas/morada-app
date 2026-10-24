import { condoSettingsSchema, type CondoSettings } from '../domain/condo-settings';
import { SettingsValidationError } from '../domain/errors';
import type { SettingsRepository } from '../domain/settings-repository';

const PIX_FIELD_PATH = 'pix';

function hasPixField(input: unknown): boolean {
  return typeof input === 'object' && input !== null && PIX_FIELD_PATH in input;
}

export async function updateSettings(
  repo: SettingsRepository,
  input: unknown,
): Promise<CondoSettings> {
  const parsed = condoSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const pixIssue = parsed.error.issues.find((issue) => issue.path[0] === PIX_FIELD_PATH);
    throw new SettingsValidationError(pixIssue?.message ?? 'Configurações inválidas');
  }
  if (hasPixField(input)) return repo.save(parsed.data);
  const current = await repo.get();
  return repo.save({ ...parsed.data, pix: current.pix });
}
