import type { Resident } from './resident';
import type { ResidentRepository } from './resident-repository';

export async function listResidents(repository: ResidentRepository): Promise<Resident[]> {
  const residents = await repository.list();
  // Order by apartment number (numeric, so "Apto 2" precedes "Apto 10").
  return [...residents].sort((a, b) => a.apt.localeCompare(b.apt, 'pt-BR', { numeric: true }));
}
