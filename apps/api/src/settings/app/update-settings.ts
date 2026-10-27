import { condoSettingsSchema, type CondoSettings } from '../domain/condo-settings';
import { SettingsValidationError } from '../domain/errors';
import type { SettingsRepository } from '../domain/settings-repository';

const PRESERVED_FIELDS = ['pix', 'openingBalance'] as const;

function hasField(input: unknown, field: string): boolean {
  return typeof input === 'object' && input !== null && field in input;
}

export async function updateSettings(
  repo: SettingsRepository,
  input: unknown,
): Promise<CondoSettings> {
  const parsed = condoSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const preservedIssue = parsed.error.issues.find((issue) =>
      PRESERVED_FIELDS.some((field) => issue.path[0] === field),
    );
    throw new SettingsValidationError(preservedIssue?.message ?? 'Configurações inválidas');
  }
  const omitted = PRESERVED_FIELDS.filter((field) => !hasField(input, field));
  if (omitted.length === 0) return repo.save(parsed.data);
  const current = await repo.get();
  const kept = Object.fromEntries(omitted.map((field) => [field, current[field]]));
  return repo.save({ ...parsed.data, ...kept });
}
