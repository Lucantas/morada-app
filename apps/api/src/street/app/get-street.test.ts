import type { CondoAccess } from '../../condos/domain/condo-access';
import type { StreetFacts } from '../domain/street';

import { getStreet } from './get-street';

const access = (overrides: Partial<CondoAccess>): CondoAccess => ({
  condominiumId: 'c-1',
  name: 'A',
  role: 'administrador',
  residentId: null,
  organizationId: 'org-1',
  orgRole: null,
  onboardingPending: false,
  ...overrides,
});

const facts = (overdueResidents: number): StreetFacts => ({
  pendencies: {
    overdueResidents,
    overdueAccounts: 0,
    accountsDueSoon: 0,
    proofsToReview: 0,
    unreadThreads: 0,
  },
  windows: [{ block: null, floor: 1, position: 1, lit: true }],
});

function makeDeps() {
  const factsFor = jest.fn(
    async (ids: readonly string[]) => new Map(ids.map((id, i) => [id, facts(i + 1)])),
  );
  return {
    factsFor,
    deps: {
      condos: {
        listForUser: async () => [
          access({ condominiumId: 'c-a', name: 'A', role: 'administrador' }),
          access({ condominiumId: 'c-b', name: 'B', role: 'sindico' }),
          access({ condominiumId: 'c-c', name: 'C', role: 'morador', residentId: 'r-1' }),
        ],
      },
      users: { findById: async () => ({ name: 'Lucia' }) },
      street: { factsFor },
    },
  };
}

describe('getStreet', () => {
  test('street lists staff condos with facts and moradia condos as homes only', async () => {
    const { deps } = makeDeps();

    const street = await getStreet(deps, 'u-1', '2026-10-28');

    expect(street?.name).toBe('Lucia');
    expect(street?.condos.map((c) => [c.id, c.pendencies.overdueResidents])).toEqual([
      ['c-a', 1],
      ['c-b', 2],
    ]);
    expect(street?.condos[0]?.windows).toHaveLength(1);
    expect(street?.homes.map((h) => h.id)).toEqual(['c-c']);
    expect(street?.homes[0]).not.toHaveProperty('pendencies');
    expect(street?.homes[0]).not.toHaveProperty('windows');
  });

  test('factsFor is called only with staff condo ids', async () => {
    const { deps, factsFor } = makeDeps();

    await getStreet(deps, 'u-1', '2026-10-28');

    expect(factsFor).toHaveBeenCalledWith(['c-a', 'c-b'], 'u-1', '2026-10-28');
  });

  test('a missing user has no street', async () => {
    const { deps } = makeDeps();

    await expect(
      getStreet({ ...deps, users: { findById: async () => null } }, 'u-1', '2026-10-28'),
    ).resolves.toBeNull();
  });
});
