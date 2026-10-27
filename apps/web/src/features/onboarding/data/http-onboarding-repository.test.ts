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
});
