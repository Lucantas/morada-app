import { buildThread } from '@/test/factories.messages';

import { InMemoryThreadRepository } from '../data/in-memory-thread-repository';

import { ThreadNotFoundError } from './errors';
import { markRead } from './mark-read';

describe('markRead', () => {
  test('sets unread to false and persists', async () => {
    const repo = new InMemoryThreadRepository([buildThread({ id: 't-1', unread: true })]);

    const updated = await markRead(repo, 't-1');

    expect(updated.unread).toBe(false);
    expect((await repo.getById('t-1'))?.unread).toBe(false);
  });

  test('does not mutate the original thread', async () => {
    const original = buildThread({ id: 't-2', unread: true });
    const repo = new InMemoryThreadRepository([original]);

    await markRead(repo, 't-2');

    expect(original.unread).toBe(true);
  });

  test('throws when the thread is missing', async () => {
    const repo = new InMemoryThreadRepository([]);

    await expect(markRead(repo, 'nope')).rejects.toBeInstanceOf(ThreadNotFoundError);
  });
});
