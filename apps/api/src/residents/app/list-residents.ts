import type { Resident } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';

export async function listResidents(repo: ResidentRepository): Promise<Resident[]> {
  return [...(await repo.list())].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
