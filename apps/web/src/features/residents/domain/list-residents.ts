import type { Resident } from './resident';
import type { ResidentRepository } from './resident-repository';

export async function listResidents(repository: ResidentRepository): Promise<Resident[]> {
  const residents = await repository.list();
  return [...residents].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
