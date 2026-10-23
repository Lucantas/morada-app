import type { CondoAccess } from '../domain/condo-access';

import { listMyCondos, resolveCondoAccess } from './condo-access-views';

const access = (overrides: Partial<CondoAccess>): CondoAccess => ({
  condominiumId: 'c-1',
  name: 'Condomínio Um',
  role: 'administrador',
  residentId: null,
  ...overrides,
});

describe('listMyCondos', () => {
  test('maps administrador to admin and morador to resident, leaving sindico out', async () => {
    const condos = {
      listForUser: async () => [
        access({ condominiumId: 'c-1', name: 'A', role: 'administrador' }),
        access({ condominiumId: 'c-2', name: 'B', role: 'sindico' }),
        access({ condominiumId: 'c-3', name: 'C', role: 'morador', residentId: 'r-1' }),
      ],
    };

    const result = await listMyCondos(condos, 'u-1');

    expect(result).toEqual([
      { id: 'c-1', name: 'A', role: 'admin' },
      { id: 'c-3', name: 'C', role: 'resident' },
    ]);
  });
});

describe('resolveCondoAccess', () => {
  const resolverFor = (found: CondoAccess | null) =>
    resolveCondoAccess({ accessFor: async () => found });

  test('an administrador acts as admin with the user id as subject', async () => {
    expect(await resolverFor(access({ role: 'administrador' }))('u-1', 'c-1')).toEqual({
      role: 'admin',
      sub: 'u-1',
    });
  });

  test('a morador acts as resident with the resident id as subject', async () => {
    const found = access({ role: 'morador', residentId: 'r-7' });
    expect(await resolverFor(found)('u-1', 'c-1')).toEqual({ role: 'resident', sub: 'r-7' });
  });

  test('a morador without a resident link has no access', async () => {
    expect(await resolverFor(access({ role: 'morador', residentId: null }))('u-1', 'c-1')).toBe(
      null,
    );
  });

  test('a sindico has no access yet', async () => {
    expect(await resolverFor(access({ role: 'sindico' }))('u-1', 'c-1')).toBe(null);
  });

  test('no grant means no access', async () => {
    expect(await resolverFor(null)('u-1', 'c-1')).toBe(null);
  });

  test('passes the user and condominium through to the repository', async () => {
    const calls: [string, string][] = [];
    const resolve = resolveCondoAccess({
      accessFor: async (userId, condominiumId) => {
        calls.push([userId, condominiumId]);
        return null;
      },
    });

    await resolve('u-2', 'c-9');

    expect(calls).toEqual([['u-2', 'c-9']]);
  });
});
