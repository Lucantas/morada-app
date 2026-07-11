import { ResidentValidationError } from '../domain/errors';
import type { Resident } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';

import { getResident } from './get-resident';
import { saveResident } from './save-resident';

function fakeRepo(): ResidentRepository {
  const map = new Map<string, Resident>();
  return {
    list: () => [...map.values()],
    getById: (id) => map.get(id) ?? null,
    save: (r) => {
      map.set(r.id, r);
      return r;
    },
  };
}

describe('saveResident', () => {
  test('assigns an id when the draft has none', () => {
    const repo = fakeRepo();
    const saved = saveResident(repo, {
      name: 'Maria',
      apt: 'Apto 302',
      phone: '',
      email: '',
      status: 'em_dia',
    });
    expect(saved.id).toMatch(/.+/);
    expect(getResident(repo, saved.id)).toEqual(saved);
  });

  test('keeps an existing id', () => {
    const repo = fakeRepo();
    const saved = saveResident(repo, {
      id: 'r-1',
      name: 'X',
      apt: 'A',
      phone: '',
      email: '',
      status: 'pendente',
    });
    expect(saved.id).toBe('r-1');
  });

  test('rejects an empty name', () => {
    expect(() =>
      saveResident(fakeRepo(), { name: '', apt: 'A', phone: '', email: '', status: 'em_dia' }),
    ).toThrow(ResidentValidationError);
  });
});

describe('getResident', () => {
  test('throws with status 404 when missing', () => {
    try {
      getResident(fakeRepo(), 'nope');
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as { status?: number }).status).toBe(404);
    }
  });
});
