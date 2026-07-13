import { ResidentNotFoundError } from '../domain/errors';
import type { ResidentRepository } from '../domain/resident-repository';

// Marks a resident as moved out, freeing their apartment for the next occupant.
export async function deactivateResident(repo: ResidentRepository, id: string): Promise<void> {
  if (!(await repo.getById(id))) throw new ResidentNotFoundError(id);
  await repo.deactivate(id);
}
