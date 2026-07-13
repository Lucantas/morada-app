import { ResidentNotFoundError } from '../domain/errors';
import type { ResidentRepository } from '../domain/resident-repository';

// Marks a resident as moved out, freeing their apartment for the next occupant.
export function deactivateResident(repo: ResidentRepository, id: string): void {
  if (!repo.getById(id)) throw new ResidentNotFoundError(id);
  repo.deactivate(id);
}
