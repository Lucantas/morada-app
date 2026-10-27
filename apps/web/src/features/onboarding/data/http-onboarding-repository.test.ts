import type { ApiClient } from '@/shared/lib/api-client';

import { HttpOnboardingRepository } from './http-onboarding-repository';

describe('HttpOnboardingRepository', () => {
  test('complete posts to the onboarding completion route', async () => {
    const post = jest.fn().mockResolvedValue(undefined);
    const api: ApiClient = { get: jest.fn(), post, put: jest.fn(), del: jest.fn() };

    await new HttpOnboardingRepository(api).complete();

    expect(post).toHaveBeenCalledWith('/api/onboarding/complete', {});
  });

  test('complete propagates a failure', async () => {
    const api: ApiClient = {
      get: jest.fn(),
      post: jest.fn().mockRejectedValue(new Error('falhou')),
      put: jest.fn(),
      del: jest.fn(),
    };

    await expect(new HttpOnboardingRepository(api).complete()).rejects.toThrow('falhou');
  });

  test('isPending reads the condo from the caller’s condos', async () => {
    const get = jest.fn().mockResolvedValue([
      { id: 'c1', name: 'A', onboardingPending: false },
      { id: 'c2', name: 'B', onboardingPending: true },
    ]);
    const api: ApiClient = { get, post: jest.fn(), put: jest.fn(), del: jest.fn() };
    const repository = new HttpOnboardingRepository(api);

    expect(await repository.isPending('c1')).toBe(false);
    expect(await repository.isPending('c2')).toBe(true);
    expect(await repository.isPending('c3')).toBe(false);
    expect(get).toHaveBeenCalledWith('/me/condos');
  });
});
