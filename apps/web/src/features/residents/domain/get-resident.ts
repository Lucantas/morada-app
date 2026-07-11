import { ResidentNotFoundError } from './errors';
import type { Resident } from './resident';
import type { ResidentRepository } from './resident-repository';

export async function getResident(repository: ResidentRepository, id: string): Promise<Resident> {
  const resident = await repository.getById(id);
  if (!resident) throw new ResidentNotFoundError(id);
  return resident;
}
