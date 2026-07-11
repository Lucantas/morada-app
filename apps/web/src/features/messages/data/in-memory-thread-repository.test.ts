import { buildMessage, buildThread } from '@/test/factories.messages';

import { ThreadNotFoundError } from '../domain/errors';

import { InMemoryThreadRepository } from './in-memory-thread-repository';

describe('InMemoryThreadRepository', () => {
  test('lists seeded threads in insertion order', async () => {
    const repo = new InMemoryThreadRepository([buildThread({ id: 'a' }), buildThread({ id: 'b' })]);

    expect((await repo.list()).map((t) => t.id)).toEqual(['a', 'b']);
  });

  test('addMessage appends and getById returns the updated thread', async () => {
    const repo = new InMemoryThreadRepository([buildThread({ id: 'x', messages: [] })]);

    const updated = await repo.addMessage('x', 'admin', 'Olá');

    expect(updated.messages).toHaveLength(1);
    expect(updated.messages[0]?.author).toBe('admin');
    expect(await repo.getById('x')).toEqual(updated);
  });

  test('addMessage does not mutate the previously returned thread (immutability)', async () => {
    const repo = new InMemoryThreadRepository([
      buildThread({ id: 'a', messages: [buildMessage()] }),
    ]);
    const before = await repo.list();

    await repo.addMessage('a', 'resident', 'Nova');

    expect(before[0]?.messages).toHaveLength(1);
  });

  test('markRead clears the unread flag', async () => {
    const repo = new InMemoryThreadRepository([buildThread({ id: 'a', unread: true })]);

    expect((await repo.markRead('a')).unread).toBe(false);
  });

  test('addMessage and markRead throw when the thread is missing', async () => {
    const repo = new InMemoryThreadRepository([]);

    await expect(repo.addMessage('nope', 'admin', 'x')).rejects.toBeInstanceOf(ThreadNotFoundError);
    await expect(repo.markRead('nope')).rejects.toBeInstanceOf(ThreadNotFoundError);
  });

  test('rejects malformed seed data at the boundary', () => {
    expect(() => new InMemoryThreadRepository([{ id: 'a', residentName: 'X' }])).toThrow();
  });
});
