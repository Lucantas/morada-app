import type { ApiClient } from '@/shared/lib/api-client';
import { ApiError } from '@/shared/lib/api-client';
import { buildAccount } from '@/test/factories.accounts';

import { HttpAccountRepository } from './http-account-repository';

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    del: jest.fn(),
    ...overrides,
  };
}

describe('HttpAccountRepository', () => {
  test('list parses the GET /api/accounts response', async () => {
    const account = buildAccount({ id: 'a-1' });
    const api = fakeApi({ get: jest.fn().mockResolvedValue([account]) });

    const result = await new HttpAccountRepository(api).list();

    expect(api.get).toHaveBeenCalledWith('/api/accounts');
    expect(result).toEqual([account]);
  });

  test('getById returns null on a 404', async () => {
    const api = fakeApi({ get: jest.fn().mockRejectedValue(new ApiError(404, 'não encontrado')) });

    expect(await new HttpAccountRepository(api).getById('nope')).toBeNull();
  });

  test('getById rethrows non-404 errors', async () => {
    const api = fakeApi({ get: jest.fn().mockRejectedValue(new ApiError(500, 'boom')) });

    await expect(new HttpAccountRepository(api).getById('x')).rejects.toBeInstanceOf(ApiError);
  });

  test('save PUTs to the id-scoped path (upsert)', async () => {
    const account = buildAccount({ id: 'a-9', description: 'Luz — maio' });
    const api = fakeApi({ put: jest.fn().mockResolvedValue(account) });

    const result = await new HttpAccountRepository(api).save(account);

    expect(api.put).toHaveBeenCalledWith('/api/accounts/a-9', account);
    expect(result).toEqual(account);
  });
});
