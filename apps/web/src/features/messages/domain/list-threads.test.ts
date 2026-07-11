import { buildThread } from '@/test/factories.messages';

import { listThreads } from './list-threads';
import type { Thread } from './message';
import type { ThreadRepository } from './thread-repository';

function fakeRepo(threads: Thread[]): ThreadRepository {
  return {
    list: async () => threads,
    getById: async (id) => threads.find((t) => t.id === id) ?? null,
    addMessage: async () => {
      throw new Error('not used in this test');
    },
    markRead: async () => {
      throw new Error('not used in this test');
    },
  };
}

describe('listThreads', () => {
  test('returns threads in insertion order', async () => {
    const repo = fakeRepo([
      buildThread({ id: 'a', residentName: 'Ana' }),
      buildThread({ id: 'b', residentName: 'Bruno' }),
      buildThread({ id: 'c', residentName: 'Carla' }),
    ]);

    const result = await listThreads(repo);

    expect(result.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  test('returns an empty array when there are no threads', async () => {
    expect(await listThreads(fakeRepo([]))).toEqual([]);
  });
});
