import type { Resident } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';

export function listResidents(repo: ResidentRepository): Resident[] {
  return [...repo.list()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
