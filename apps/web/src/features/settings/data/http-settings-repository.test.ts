import type { ApiClient } from '@/shared/lib/api-client';

import { HttpSettingsRepository } from './http-settings-repository';

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    del: jest.fn(),
    ...overrides,
  };
}

describe('HttpSettingsRepository', () => {
  test('get parses the GET /api/settings response', async () => {
    const settings = { monthlyFeeCents: 15000, dueDay: 15 };
    const api = fakeApi({ get: jest.fn().mockResolvedValue(settings) });

    const result = await new HttpSettingsRepository(api).get();

    expect(api.get).toHaveBeenCalledWith('/api/settings');
    expect(result).toEqual(settings);
  });

  test('save PUTs to /api/settings and parses the response', async () => {
    const settings = { monthlyFeeCents: 20000, dueDay: 10 };
    const api = fakeApi({ put: jest.fn().mockResolvedValue(settings) });

    const result = await new HttpSettingsRepository(api).save(settings);

    expect(api.put).toHaveBeenCalledWith('/api/settings', settings);
    expect(result).toEqual(settings);
  });
});
