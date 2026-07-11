import { InMemoryNoticeRepository } from '../data/in-memory-notice-repository';
import { buildNotice } from '@/test/factories.notices';

import { clearNotices, dismissNotice } from './dismiss-notice';
import { NoticeNotFoundError } from './errors';

describe('dismissNotice', () => {
  test('marks the notice as dismissed', async () => {
    const repo = new InMemoryNoticeRepository([buildNotice({ id: 'n-1', dismissed: false })]);

    const result = await dismissNotice(repo, 'n-1');

    expect(result.dismissed).toBe(true);
    expect((await repo.getById('n-1'))?.dismissed).toBe(true);
  });

  test('does not mutate the stored notice in place', async () => {
    const original = buildNotice({ id: 'n-1', dismissed: false });
    const repo = new InMemoryNoticeRepository([original]);

    await dismissNotice(repo, 'n-1');

    expect(original.dismissed).toBe(false);
  });

  test('throws when the notice is missing', async () => {
    const repo = new InMemoryNoticeRepository([]);

    await expect(dismissNotice(repo, 'missing')).rejects.toBeInstanceOf(NoticeNotFoundError);
  });
});

describe('clearNotices', () => {
  test('dismisses every active notice', async () => {
    const repo = new InMemoryNoticeRepository([
      buildNotice({ id: 'n-1', dismissed: false }),
      buildNotice({ id: 'n-2', dismissed: false }),
      buildNotice({ id: 'n-3', dismissed: true }),
    ]);

    await clearNotices(repo);

    const all = await repo.list();
    expect(all.every((n) => n.dismissed)).toBe(true);
  });

  test('does not mutate the previously listed notices', async () => {
    const repo = new InMemoryNoticeRepository([buildNotice({ id: 'n-1', dismissed: false })]);
    const before = await repo.list();

    await clearNotices(repo);

    expect(before[0]?.dismissed).toBe(false);
  });
});
