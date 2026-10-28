import type { Thread } from '../domain/message';
import { inMemoryThreads as fakeRepo } from '../../test-support/in-memory-threads';

import { getThread } from './get-thread';
import { listThreads } from './list-threads';
import { markRead } from './mark-read';
import { postMessage } from './post-message';
import { unreadCount } from './unread-count';

const build = (over: Partial<Thread>): Thread => ({
  id: 'x',
  residentName: 'Nome',
  apt: 'Apto 1',
  residentId: null,
  apartmentId: null,
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
    expect((await listThreads(repo, 'u-1')).map((t) => t.residentName)).toEqual([
      'Ana',
      'Bruno',
      'Carla',
    ]);
  });
});

describe('getThread', () => {
  test('throws with status 404 when missing', async () => {
    try {
      await getThread(fakeRepo([]), 'nope', 'u-1');
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

    const updated = await postMessage(repo, 't-1', 'admin', 'Olá', 'u-1');

    expect(original.messages).toHaveLength(0);
    expect(updated.messages).toHaveLength(1);
    expect(updated.messages[0]).toMatchObject({ author: 'admin', text: 'Olá', dateLabel: 'Agora' });
    expect(updated.messages[0]?.id).toMatch(/.+/);
  });

  test('postMessage by a resident records the resident message', async () => {
    const repo = fakeRepo([build({ id: 't-1', unread: false })]);

    await postMessage(repo, 't-1', 'resident', 'Oi', 'u-resident');

    expect((await repo.getById('t-1', 'u-admin'))?.unread).toBe(true);
  });

  test('postMessage by staff marks the thread read for that staff member only', async () => {
    const repo = fakeRepo([build({ id: 't-1', unread: true })]);

    const updated = await postMessage(repo, 't-1', 'admin', 'Resposta', 'u-admin');

    expect(updated.unread).toBe(false);
    expect((await repo.getById('t-1', 'u-sindico'))?.unread).toBe(true);
  });

  test('rejects empty text', async () => {
    const repo = fakeRepo([build({ id: 't-1' })]);
    try {
      await postMessage(repo, 't-1', 'admin', '   ', 'u-1');
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as { status?: number }).status).toBe(400);
    }
  });

  test('throws 404 when the thread is missing', async () => {
    try {
      await postMessage(fakeRepo([]), 'nope', 'admin', 'Oi', 'u-1');
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as { status?: number }).status).toBe(404);
    }
  });
});

describe('markRead', () => {
  test('clears the unread flag for the reader only', async () => {
    const repo = fakeRepo([build({ id: 't-1', unread: true })]);

    expect((await markRead(repo, 't-1', 'u-admin')).unread).toBe(false);
    expect((await repo.getById('t-1', 'u-sindico'))?.unread).toBe(true);
  });

  test('throws 404 when the thread is missing', async () => {
    await expect(markRead(fakeRepo([]), 'nope', 'u-admin')).rejects.toMatchObject({ status: 404 });
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
