import { randomUUID } from 'node:crypto';

import { ResidentValidationError } from '../domain/errors';
import { residentDraftSchema, residentSchema, type Resident } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';

export function saveResident(repo: ResidentRepository, draft: unknown): Resident {
  const parsed = residentDraftSchema.safeParse(draft);
  if (!parsed.success) throw new ResidentValidationError('Dados do morador inválidos');
  const resident = residentSchema.parse({ ...parsed.data, id: parsed.data.id ?? randomUUID() });
  return repo.save(resident);
}
