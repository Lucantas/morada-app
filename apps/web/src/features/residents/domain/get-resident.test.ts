import { buildResident } from '@/test/factories';

import { InMemoryResidentRepository } from '../data/in-memory-resident-repository';

import { ResidentNotFoundError } from './errors';
import { getResident } from './get-resident';

describe('getResident', () => {
  test('returns the resident when it exists', async () => {
    const resident = buildResident({ id: 'r-9', name: 'Ana' });
    const repo = new InMemoryResidentRepository([resident]);

    expect(await getResident(repo, 'r-9')).toEqual(resident);
  });

  test('throws ResidentNotFoundError when missing', async () => {
    const repo = new InMemoryResidentRepository([]);

    await expect(getResident(repo, 'nope')).rejects.toBeInstanceOf(ResidentNotFoundError);
  });
});
