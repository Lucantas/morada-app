import { createTestDb } from '../../../platform/db';

import { SqliteNoticeRepository } from './notice-repository';

describe('SqliteNoticeRepository', () => {
  test('save then getById round-trips through SQLite including dismissed boolean', async () => {
    const repo = new SqliteNoticeRepository(createTestDb());
    const notice = {
      id: 'n-1',
      title: 'Aviso',
      body: 'Corpo do aviso',
      kind: 'aviso' as const,
      audience: 'todos',
      dateLabel: 'Agora',
      dismissed: true,
    };

    await repo.save(notice);

    expect(await repo.getById('n-1')).toEqual(notice);
  });

  test('persists dismissed false as integer 0 and reads it back as boolean', async () => {
    const repo = new SqliteNoticeRepository(createTestDb());
    await repo.save({
      id: 'n-1',
      title: 'Aviso',
      body: 'Corpo',
      kind: 'aviso',
      audience: 'todos',
      dateLabel: 'Agora',
      dismissed: false,
    });

    expect((await repo.getById('n-1'))?.dismissed).toBe(false);
  });

  test('save upserts on conflicting id', async () => {
    const repo = new SqliteNoticeRepository(createTestDb());
    await repo.save({
      id: 'n-1',
      title: 'Aviso',
      body: 'Corpo',
      kind: 'aviso',
      audience: 'todos',
      dateLabel: 'Agora',
      dismissed: false,
    });
    await repo.save({
      id: 'n-1',
      title: 'Aviso atualizado',
      body: 'Corpo',
      kind: 'urgente',
      audience: 'todos',
      dateLabel: 'Agora',
      dismissed: true,
    });

    expect(await repo.list()).toHaveLength(1);
    expect((await repo.getById('n-1'))?.title).toBe('Aviso atualizado');
    expect((await repo.getById('n-1'))?.dismissed).toBe(true);
  });

  test('remove deletes the notice', async () => {
    const repo = new SqliteNoticeRepository(createTestDb());
    await repo.save({
      id: 'n-1',
      title: 'Aviso',
      body: 'Corpo',
      kind: 'aviso',
      audience: 'todos',
      dateLabel: 'Agora',
      dismissed: false,
    });

    await repo.remove('n-1');

    expect(await repo.getById('n-1')).toBeNull();
    expect(await repo.list()).toHaveLength(0);
  });

  test('getById returns null when missing', async () => {
    expect(await new SqliteNoticeRepository(createTestDb()).getById('nope')).toBeNull();
  });
});
