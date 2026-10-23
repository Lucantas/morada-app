import type { ApiClient } from '@/shared/lib/api-client';

import { HttpCondoInfoRepository } from './http-condo-info-repository';

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    del: jest.fn(),
    ...overrides,
  };
}

describe('HttpCondoInfoRepository', () => {
  test('get parses the GET /api/info response', async () => {
    const info = { id: 'c1', name: 'Residencial Ipê' };
    const api = fakeApi({ get: jest.fn().mockResolvedValue(info) });

    const result = await new HttpCondoInfoRepository(api).get();

    expect(api.get).toHaveBeenCalledWith('/api/info');
    expect(result).toEqual(info);
  });

  test('rename PUTs the name to /api/info and parses the response', async () => {
    const api = fakeApi({ put: jest.fn().mockResolvedValue({ id: 'c1', name: 'Novo' }) });

    const result = await new HttpCondoInfoRepository(api).rename('Novo');

    expect(api.put).toHaveBeenCalledWith('/api/info', { name: 'Novo' });
    expect(result).toEqual({ id: 'c1', name: 'Novo' });
  });

  test('rejects a malformed response', async () => {
    const api = fakeApi({ get: jest.fn().mockResolvedValue({ id: 'c1' }) });

    await expect(new HttpCondoInfoRepository(api).get()).rejects.toThrow();
  });
});
