import { ResidentValidationError } from './errors';
import { residentDraftSchema, residentSchema, type Resident, type ResidentDraft } from './resident';
import type { ResidentRepository } from './resident-repository';

export async function saveResident(
  repository: ResidentRepository,
  draft: ResidentDraft,
): Promise<Resident> {
  const parsedDraft = residentDraftSchema.safeParse(draft);
  if (!parsedDraft.success) {
    throw new ResidentValidationError('Dados do morador inválidos');
  }
  const resident = residentSchema.parse({
    ...parsedDraft.data,
    id: parsedDraft.data.id ?? crypto.randomUUID(),
  });
  return repository.save(resident);
}
