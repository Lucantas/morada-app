import { createTestDb } from '../../../platform/db';
import type { Thread } from '../../domain/message';

import { SqliteThreadRepository } from './thread-repository';

const build = (over: Partial<Thread>): Thread => ({
  id: 't-1',
  residentName: 'Ana',
  apt: 'Apto 1',
  unread: false,
  messages: [],
  ...over,
});

describe('SqliteThreadRepository', () => {
  test('save then getById round-trips including messages and unread', async () => {
    const repo = new SqliteThreadRepository(createTestDb());
    const thread = build({
      id: 't-1',
      unread: true,
      messages: [{ id: 'm-1', author: 'resident', text: 'Oi', dateLabel: 'Agora' }],
    });

    await repo.save(thread);

    expect(await repo.getById('t-1')).toEqual(thread);
  });

  test('save upserts on conflicting id', async () => {
    const repo = new SqliteThreadRepository(createTestDb());
    await repo.save(build({ id: 't-1', residentName: 'Ana', unread: false }));
    await repo.save(build({ id: 't-1', residentName: 'Ana Paula', unread: true }));

    expect(await repo.list()).toHaveLength(1);
    expect((await repo.getById('t-1'))?.residentName).toBe('Ana Paula');
    expect((await repo.getById('t-1'))?.unread).toBe(true);
  });

  test('persists appended messages', async () => {
    const repo = new SqliteThreadRepository(createTestDb());
    await repo.save(build({ id: 't-1', messages: [] }));

    const stored = await repo.getById('t-1');
    if (!stored) throw new Error('thread should exist');
    await repo.save({
      ...stored,
      messages: [
        ...stored.messages,
        { id: 'm-1', author: 'admin', text: 'Olá', dateLabel: 'Agora' },
      ],
    });

    expect((await repo.getById('t-1'))?.messages).toHaveLength(1);
    expect((await repo.getById('t-1'))?.messages[0]?.text).toBe('Olá');
  });

  test('getById returns null when missing', async () => {
    expect(await new SqliteThreadRepository(createTestDb()).getById('nope')).toBeNull();
  });
});
