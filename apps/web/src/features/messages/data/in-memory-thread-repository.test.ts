import { buildThread } from '@/test/factories.messages';

import { InMemoryThreadRepository } from './in-memory-thread-repository';

describe('InMemoryThreadRepository', () => {
  test('lists seeded threads in insertion order', async () => {
    const repo = new InMemoryThreadRepository([buildThread({ id: 'a' }), buildThread({ id: 'b' })]);

    expect((await repo.list()).map((t) => t.id)).toEqual(['a', 'b']);
  });

  test('save upserts and getById returns it', async () => {
    const repo = new InMemoryThreadRepository([]);
    const thread = buildThread({ id: 'x', residentName: 'Nova' });

    await repo.save(thread);

    expect(await repo.getById('x')).toEqual(thread);
  });

  test('save does not mutate the previously returned list (immutability)', async () => {
    const repo = new InMemoryThreadRepository([buildThread({ id: 'a' })]);
    const before = await repo.list();

    await repo.save(buildThread({ id: 'b' }));

    expect(before).toHaveLength(1);
  });

  test('rejects malformed seed data at the boundary', () => {
    expect(() => new InMemoryThreadRepository([{ id: 'a', residentName: 'X' }])).toThrow();
  });
});
