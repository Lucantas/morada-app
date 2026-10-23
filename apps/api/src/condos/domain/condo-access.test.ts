import { resolveAccess, type CondoAccess } from './condo-access';

const grant = (overrides: Partial<CondoAccess>): CondoAccess => ({
  condominiumId: 'condo-a',
  name: 'A',
  role: 'morador',
  residentId: null,
  ...overrides,
});

describe('resolveAccess', () => {
  test('keeps the highest role regardless of grant order, carrying the morador resident', () => {
    const morador = grant({ role: 'morador', residentId: 'r-1' });
    const sindico = grant({ role: 'sindico' });
    const administrador = grant({ role: 'administrador' });
    const expected = grant({ role: 'administrador', residentId: 'r-1' });

    expect(resolveAccess([morador, sindico, administrador])).toEqual([expected]);
    expect(resolveAccess([administrador, sindico, morador])).toEqual([expected]);
  });

  test('returns one entry per condo ordered by name, then id', () => {
    const list = resolveAccess([
      grant({ condominiumId: 'condo-z', name: 'Ipê' }),
      grant({ condominiumId: 'condo-b', name: 'Aurora' }),
      grant({ condominiumId: 'condo-a', name: 'Aurora' }),
    ]);

    expect(list.map((access) => access.condominiumId)).toEqual(['condo-a', 'condo-b', 'condo-z']);
  });

  test('returns an empty list when there are no grants', () => {
    expect(resolveAccess([])).toEqual([]);
  });
});
