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
    const settings = { monthlyFeeCents: 15000, dueDay: 15, pix: null };
    const api = fakeApi({ get: jest.fn().mockResolvedValue(settings) });

    const result = await new HttpSettingsRepository(api).get();

    expect(api.get).toHaveBeenCalledWith('/api/settings');
    expect(result).toEqual(settings);
  });

  test('save PUTs to /api/settings and parses the response', async () => {
    const settings = { monthlyFeeCents: 20000, dueDay: 10, pix: null };
    const api = fakeApi({ put: jest.fn().mockResolvedValue(settings) });

    const result = await new HttpSettingsRepository(api).save(settings);

    expect(api.put).toHaveBeenCalledWith('/api/settings', settings);
    expect(result).toEqual(settings);
  });
});

describe('HttpSettingsRepository pix', () => {
  const pix = {
    keyType: 'email' as const,
    key: 'a@b.com',
    receiverName: 'Morada',
    city: 'Sao Paulo',
  };

  test('get exposes the stored pix and defaults to null', async () => {
    const withPix = fakeApi({
      get: jest.fn().mockResolvedValue({ monthlyFeeCents: 1, dueDay: 2, pix }),
    });
    const without = fakeApi({
      get: jest.fn().mockResolvedValue({ monthlyFeeCents: 1, dueDay: 2 }),
    });

    expect((await new HttpSettingsRepository(withPix).get()).pix).toEqual(pix);
    expect((await new HttpSettingsRepository(without).get()).pix).toBeNull();
  });

  test('save omits pix when absent, sends null to clear and the object to set', async () => {
    const put = jest.fn().mockResolvedValue({ monthlyFeeCents: 1, dueDay: 2, pix: null });
    const repository = new HttpSettingsRepository(fakeApi({ put }));

    await repository.save({ monthlyFeeCents: 1, dueDay: 2 });
    await repository.save({ monthlyFeeCents: 1, dueDay: 2, pix: null });
    await repository.save({ monthlyFeeCents: 1, dueDay: 2, pix });

    expect(put.mock.calls[0]?.[1]).toEqual({ monthlyFeeCents: 1, dueDay: 2 });
    expect(put.mock.calls[0]?.[1]).not.toHaveProperty('pix');
    expect(put.mock.calls[1]?.[1]).toEqual({ monthlyFeeCents: 1, dueDay: 2, pix: null });
    expect(put.mock.calls[2]?.[1]).toEqual({ monthlyFeeCents: 1, dueDay: 2, pix });
  });
});
