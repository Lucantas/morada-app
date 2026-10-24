import type { ApiClient } from '@/shared/lib/api-client';

import { HttpPixRepository } from './http-pix-repository';

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    del: jest.fn(),
    ...overrides,
  };
}

describe('HttpPixRepository', () => {
  test('get parses a configured response from GET /api/pix', async () => {
    const pix = { configured: true, key: 'a@b.com', receiverName: 'Morada', city: 'SP' };
    const api = fakeApi({ get: jest.fn().mockResolvedValue(pix) });

    const result = await new HttpPixRepository(api).get();

    expect(api.get).toHaveBeenCalledWith('/api/pix');
    expect(result).toEqual(pix);
  });

  test('get parses the not-configured response', async () => {
    const api = fakeApi({ get: jest.fn().mockResolvedValue({ configured: false }) });

    expect(await new HttpPixRepository(api).get()).toEqual({ configured: false });
  });

  test('get rejects a malformed response', async () => {
    const api = fakeApi({ get: jest.fn().mockResolvedValue({ configured: true }) });

    await expect(new HttpPixRepository(api).get()).rejects.toThrow();
  });
});
