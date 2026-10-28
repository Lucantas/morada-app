import type { ApiClient } from '@/shared/lib/api-client';

import { HttpStreetRepository } from './http-street-repository';

const condo = {
  id: 'c1',
  name: 'Morada',
  role: 'admin',
  condoRole: 'administrador',
  permissions: ['view_building'],
  hasHome: false,
  organizationId: 'o1',
  orgRole: null,
  pendencies: {
    overdueResidents: 1,
    overdueAccounts: 0,
    accountsDueSoon: 0,
    proofsToReview: 0,
    unreadThreads: 2,
  },
  windows: [{ block: null, floor: 1, position: 1, lit: true }],
};

function apiWith(get: jest.Mock): ApiClient {
  return { get, post: jest.fn(), put: jest.fn(), del: jest.fn() };
}

describe('HttpStreetRepository', () => {
  test('reads the street from /me/street', async () => {
    const get = jest.fn().mockResolvedValue({ name: 'Lucas', condos: [condo], homes: [] });

    const street = await new HttpStreetRepository(apiWith(get)).get();

    expect(get).toHaveBeenCalledWith('/me/street');
    expect(street.name).toBe('Lucas');
    expect(street.condos[0]?.pendencies.unreadThreads).toBe(2);
    expect(street.condos[0]?.onboardingPending).toBe(false);
  });

  test('rejects an invalid payload', async () => {
    const get = jest.fn().mockResolvedValue({ name: null, condos: [{ id: 'c1' }], homes: [] });

    await expect(new HttpStreetRepository(apiWith(get)).get()).rejects.toThrow();
  });

  test('rejects negative counts', async () => {
    const bad = { ...condo, pendencies: { ...condo.pendencies, unreadThreads: -1 } };
    const get = jest.fn().mockResolvedValue({ name: null, condos: [bad], homes: [] });

    await expect(new HttpStreetRepository(apiWith(get)).get()).rejects.toThrow();
  });

  test('propagates a failure', async () => {
    const get = jest.fn().mockRejectedValue(new Error('falhou'));

    await expect(new HttpStreetRepository(apiWith(get)).get()).rejects.toThrow('falhou');
  });
});
