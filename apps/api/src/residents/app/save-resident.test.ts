import { ResidentValidationError } from '../domain/errors';
import type { Resident } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';

import { getResident } from './get-resident';
import { saveResident } from './save-resident';

function fakeRepo(): ResidentRepository {
  const map = new Map<string, Resident>();
  return {
    list: async () => [...map.values()].filter((r) => r.active),
    getById: async (id) => map.get(id) ?? null,
    listByApartment: async (aid) => [...map.values()].filter((r) => r.apartmentId === aid),
    apartmentOf: async (id) => {
      const r = map.get(id);
      return r ? { apartmentId: r.apartmentId, apt: r.apt } : null;
    },
    save: async (input) => {
      const resident: Resident = { ...input, apartmentId: `ap-${input.apt}`, active: true };
      map.set(input.id, resident);
      return resident;
    },
    deactivate: async (id) => {
      const r = map.get(id);
      if (r) map.set(id, { ...r, active: false });
    },
  };
}

describe('saveResident', () => {
  test('assigns an id when the draft has none', async () => {
    const repo = fakeRepo();
    const saved = await saveResident(repo, {
      name: 'Maria',
      apt: 'Apto 302',
      phone: '',
      email: '',
      status: 'em_dia',
    });
    expect(saved.id).toMatch(/.+/);
    expect(await getResident(repo, saved.id)).toEqual(saved);
  });

  test('keeps an existing id', async () => {
    const repo = fakeRepo();
    const saved = await saveResident(repo, {
      id: 'r-1',
      name: 'X',
      apt: 'A',
      phone: '',
      email: '',
      status: 'pendente',
    });
    expect(saved.id).toBe('r-1');
  });

  test('rejects an empty name', async () => {
    await expect(
      saveResident(fakeRepo(), { name: '', apt: 'A', phone: '', email: '', status: 'em_dia' }),
    ).rejects.toThrow(ResidentValidationError);
  });
});

describe('getResident', () => {
  test('throws with status 404 when missing', async () => {
    try {
      await getResident(fakeRepo(), 'nope');
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as { status?: number }).status).toBe(404);
    }
  });
});
