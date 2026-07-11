import { createTestDb } from '../../../platform/db';

import { SqliteNoticeRepository } from './notice-repository';

describe('SqliteNoticeRepository', () => {
  test('save then getById round-trips through SQLite including dismissed boolean', () => {
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

    repo.save(notice);

    expect(repo.getById('n-1')).toEqual(notice);
  });

  test('persists dismissed false as integer 0 and reads it back as boolean', () => {
    const repo = new SqliteNoticeRepository(createTestDb());
    repo.save({
      id: 'n-1',
      title: 'Aviso',
      body: 'Corpo',
      kind: 'aviso',
      audience: 'todos',
      dateLabel: 'Agora',
      dismissed: false,
    });

    expect(repo.getById('n-1')?.dismissed).toBe(false);
  });

  test('save upserts on conflicting id', () => {
    const repo = new SqliteNoticeRepository(createTestDb());
    repo.save({
      id: 'n-1',
      title: 'Aviso',
      body: 'Corpo',
      kind: 'aviso',
      audience: 'todos',
      dateLabel: 'Agora',
      dismissed: false,
    });
    repo.save({
      id: 'n-1',
      title: 'Aviso atualizado',
      body: 'Corpo',
      kind: 'urgente',
      audience: 'todos',
      dateLabel: 'Agora',
      dismissed: true,
    });

    expect(repo.list()).toHaveLength(1);
    expect(repo.getById('n-1')?.title).toBe('Aviso atualizado');
    expect(repo.getById('n-1')?.dismissed).toBe(true);
  });

  test('remove deletes the notice', () => {
    const repo = new SqliteNoticeRepository(createTestDb());
    repo.save({
      id: 'n-1',
      title: 'Aviso',
      body: 'Corpo',
      kind: 'aviso',
      audience: 'todos',
      dateLabel: 'Agora',
      dismissed: false,
    });

    repo.remove('n-1');

    expect(repo.getById('n-1')).toBeNull();
    expect(repo.list()).toHaveLength(0);
  });

  test('getById returns null when missing', () => {
    expect(new SqliteNoticeRepository(createTestDb()).getById('nope')).toBeNull();
  });
});
