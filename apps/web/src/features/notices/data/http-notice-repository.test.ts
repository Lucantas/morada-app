import type { ApiClient } from '@/shared/lib/api-client';
import { buildNotice } from '@/test/factories.notices';

import { HttpNoticeRepository } from './http-notice-repository';

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    del: jest.fn(),
    ...overrides,
  };
}

describe('HttpNoticeRepository', () => {
  test('list parses the GET /api/notices response', async () => {
    const notice = buildNotice({ id: 'n-1' });
    const api = fakeApi({ get: jest.fn().mockResolvedValue([notice]) });

    const result = await new HttpNoticeRepository(api).list();

    expect(api.get).toHaveBeenCalledWith('/api/notices');
    expect(result).toEqual([notice]);
  });

  test('getById finds the notice by id from the list', async () => {
    const target = buildNotice({ id: 'n-2' });
    const other = buildNotice({ id: 'n-3' });
    const api = fakeApi({ get: jest.fn().mockResolvedValue([other, target]) });

    const result = await new HttpNoticeRepository(api).getById('n-2');

    expect(result).toEqual(target);
  });

  test('getById returns null when no notice matches the id', async () => {
    const api = fakeApi({ get: jest.fn().mockResolvedValue([buildNotice({ id: 'n-4' })]) });

    expect(await new HttpNoticeRepository(api).getById('missing')).toBeNull();
  });

  test('save POSTs to /api/notices when the notice is not dismissed', async () => {
    const notice = buildNotice({ id: 'n-5', dismissed: false });
    const api = fakeApi({ post: jest.fn().mockResolvedValue(notice) });

    const result = await new HttpNoticeRepository(api).save(notice);

    expect(api.post).toHaveBeenCalledWith('/api/notices', notice);
    expect(result).toEqual(notice);
  });

  test('save POSTs to the dismiss path when the notice is dismissed', async () => {
    const notice = buildNotice({ id: 'n-6', dismissed: true });
    const api = fakeApi({ post: jest.fn().mockResolvedValue(notice) });

    const result = await new HttpNoticeRepository(api).save(notice);

    expect(api.post).toHaveBeenCalledWith('/api/notices/n-6/dismiss');
    expect(result).toEqual(notice);
  });

  test('remove calls DELETE on the id-scoped path', async () => {
    const api = fakeApi({ del: jest.fn().mockResolvedValue(undefined) });

    await new HttpNoticeRepository(api).remove('n-7');

    expect(api.del).toHaveBeenCalledWith('/api/notices/n-7');
  });
});
