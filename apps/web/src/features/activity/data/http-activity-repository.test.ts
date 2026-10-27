import type { ApiClient } from '@/shared/lib/api-client';

import { HttpActivityRepository } from './http-activity-repository';

function fakeApi(get: jest.Mock): ApiClient {
  return { get, post: jest.fn(), put: jest.fn(), del: jest.fn() };
}

describe('HttpActivityRepository', () => {
  test('list parses the GET /api/activity response', async () => {
    const entry = {
      id: 'a-1',
      action: 'account.created',
      label: 'Conta lançada',
      actorName: 'Ana',
      subjectId: null,
      at: '2026-05-03T12:05:00.000Z',
    };
    const get = jest.fn().mockResolvedValue([entry]);

    const result = await new HttpActivityRepository(fakeApi(get)).list();

    expect(get).toHaveBeenCalledWith('/api/activity');
    expect(result).toEqual([entry]);
  });

  test('list rejects a malformed response', async () => {
    const get = jest.fn().mockResolvedValue([{ id: 'a-1' }]);

    await expect(new HttpActivityRepository(fakeApi(get)).list()).rejects.toThrow();
  });
});
