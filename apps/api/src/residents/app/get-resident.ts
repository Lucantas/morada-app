import { ResidentNotFoundError } from '../domain/errors';
import type { Resident } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';

export async function getResident(repo: ResidentRepository, id: string): Promise<Resident> {
  const resident = await repo.getById(id);
  if (!resident) throw new ResidentNotFoundError(id);
  return resident;
}
