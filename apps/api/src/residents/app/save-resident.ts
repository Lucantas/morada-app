import { randomUUID } from 'node:crypto';

import { ResidentValidationError } from '../domain/errors';
import { residentDraftSchema, type Resident } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';

export async function saveResident(repo: ResidentRepository, draft: unknown): Promise<Resident> {
  const parsed = residentDraftSchema.safeParse(draft);
  if (!parsed.success) throw new ResidentValidationError('Dados do morador inválidos');
  const { id, name, apt, phone, email, status } = parsed.data;
  return repo.save({ id: id ?? randomUUID(), name, apt, phone, email, status });
}
