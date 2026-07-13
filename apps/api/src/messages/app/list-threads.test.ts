import type { Thread } from '../domain/message';
import type { ThreadRepository } from '../domain/thread-repository';

import { getThread } from './get-thread';
import { listThreads } from './list-threads';
import { markRead } from './mark-read';
import { postMessage } from './post-message';
import { unreadCount } from './unread-count';

function fakeRepo(list: Thread[]): ThreadRepository {
  const map = new Map(list.map((t) => [t.id, t]));
  return {
    list: async () => [...map.values()],
    getById: async (id) => map.get(id) ?? null,
    save: async (t) => {
      map.set(t.id, t);
      return t;
    },
  };
}

const build = (over: Partial<Thread>): Thread => ({
  id: 'x',
  residentName: 'Nome',
  apt: 'Apto 1',
  unread: false,
  messages: [],
  ...over,
});

describe('listThreads', () => {
  test('returns threads sorted by resident name', async () => {
    const repo = fakeRepo([
      build({ id: 'b', residentName: 'Bruno' }),
      build({ id: 'a', residentName: 'Ana' }),
      build({ id: 'c', residentName: 'Carla' }),
    ]);
    expect((await listThreads(repo)).map((t) => t.residentName)).toEqual(['Ana', 'Bruno', 'Carla']);
  });
});

describe('getThread', () => {
  test('throws with status 404 when missing', async () => {
    try {
      await getThread(fakeRepo([]), 'nope');
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as { status?: number }).status).toBe(404);
    }
  });
});

describe('postMessage', () => {
  test('appends a message immutably', async () => {
    const original = build({ id: 't-1', messages: [] });
    const repo = fakeRepo([original]);

    const updated = await postMessage(repo, 't-1', 'admin', 'Olá');

    expect(original.messages).toHaveLength(0);
    expect(updated.messages).toHaveLength(1);
    expect(updated.messages[0]).toMatchObject({ author: 'admin', text: 'Olá', dateLabel: 'Agora' });
    expect(updated.messages[0]?.id).toMatch(/.+/);
  });

  test('marks unread when the author is a resident', async () => {
    const repo = fakeRepo([build({ id: 't-1', unread: false })]);
    expect((await postMessage(repo, 't-1', 'resident', 'Oi')).unread).toBe(true);
  });

  test('clears unread when the author is an admin', async () => {
    const repo = fakeRepo([build({ id: 't-1', unread: true })]);
    expect((await postMessage(repo, 't-1', 'admin', 'Resposta')).unread).toBe(false);
  });

  test('rejects empty text', async () => {
    const repo = fakeRepo([build({ id: 't-1' })]);
    try {
      await postMessage(repo, 't-1', 'admin', '   ');
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as { status?: number }).status).toBe(400);
    }
  });

  test('throws 404 when the thread is missing', async () => {
    try {
      await postMessage(fakeRepo([]), 'nope', 'admin', 'Oi');
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as { status?: number }).status).toBe(404);
    }
  });
});

describe('markRead', () => {
  test('clears the unread flag', async () => {
    const repo = fakeRepo([build({ id: 't-1', unread: true })]);
    expect((await markRead(repo, 't-1')).unread).toBe(false);
  });
});

describe('unreadCount', () => {
  test('counts only threads flagged unread', () => {
    const threads = [
      build({ id: 'a', unread: true }),
      build({ id: 'b', unread: false }),
      build({ id: 'c', unread: true }),
    ];
    expect(unreadCount(threads)).toBe(2);
  });
});
