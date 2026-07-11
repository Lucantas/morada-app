import { buildNotice } from '@/test/factories.notices';

import { InMemoryNoticeRepository } from './in-memory-notice-repository';

describe('InMemoryNoticeRepository', () => {
  test('lists seeded notices in insertion order', async () => {
    const repo = new InMemoryNoticeRepository([buildNotice({ id: 'a' }), buildNotice({ id: 'b' })]);

    expect((await repo.list()).map((n) => n.id)).toEqual(['a', 'b']);
  });

  test('save upserts and getById returns it', async () => {
    const repo = new InMemoryNoticeRepository([]);
    const notice = buildNotice({ id: 'x', dismissed: true });

    await repo.save(notice);

    expect(await repo.getById('x')).toEqual(notice);
  });

  test('remove deletes the notice', async () => {
    const repo = new InMemoryNoticeRepository([buildNotice({ id: 'a' })]);

    await repo.remove('a');

    expect(await repo.getById('a')).toBeNull();
  });

  test('save does not mutate the previously returned list', async () => {
    const repo = new InMemoryNoticeRepository([buildNotice({ id: 'a' })]);
    const before = await repo.list();

    await repo.save(buildNotice({ id: 'b' }));

    expect(before).toHaveLength(1);
  });

  test('remove does not mutate the previously returned list', async () => {
    const repo = new InMemoryNoticeRepository([buildNotice({ id: 'a' })]);
    const before = await repo.list();

    await repo.remove('a');

    expect(before).toHaveLength(1);
  });

  test('rejects malformed seed data at the boundary', () => {
    expect(() => new InMemoryNoticeRepository([{ id: 'a', title: 'X' }])).toThrow();
  });
});
