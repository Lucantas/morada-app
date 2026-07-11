import { buildThread } from '@/test/factories.messages';

import { InMemoryThreadRepository } from '../data/in-memory-thread-repository';

import { ThreadNotFoundError } from './errors';
import { getThread } from './get-thread';

describe('getThread', () => {
  test('returns the thread when it exists', async () => {
    const thread = buildThread({ id: 't-9', residentName: 'Ana' });
    const repo = new InMemoryThreadRepository([thread]);

    expect(await getThread(repo, 't-9')).toEqual(thread);
  });

  test('throws ThreadNotFoundError when missing', async () => {
    const repo = new InMemoryThreadRepository([]);

    await expect(getThread(repo, 'nope')).rejects.toBeInstanceOf(ThreadNotFoundError);
  });
});
