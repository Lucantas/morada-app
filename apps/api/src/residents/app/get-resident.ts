import { ResidentNotFoundError } from '../domain/errors';
import type { Resident } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';

export function getResident(repo: ResidentRepository, id: string): Resident {
  const resident = repo.getById(id);
  if (!resident) throw new ResidentNotFoundError(id);
  return resident;
}
