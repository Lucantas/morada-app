import { NoticeValidationError } from '../domain/errors';
import type { Notice } from '../domain/notice';
import type { NoticeRepository } from '../domain/notice-repository';

import { createNotice } from './create-notice';

function fakeRepo(): NoticeRepository {
  const map = new Map<string, Notice>();
  return {
    list: async () => [...map.values()],
    getById: async (id) => map.get(id) ?? null,
    save: async (n) => {
      map.set(n.id, n);
      return n;
    },
    remove: async (id) => {
      map.delete(id);
    },
  };
}

const draft = (over: Record<string, unknown> = {}) => ({
  title: 'Manutenção do elevador',
  body: 'O elevador ficará indisponível.',
  kind: 'manutencao',
  audience: 'todos',
  ...over,
});

describe('createNotice', () => {
  test('assigns an id, defaults dateLabel to Agora and dismissed to false', async () => {
    const repo = fakeRepo();
    const saved = await createNotice(repo, draft());
    expect(saved.id).toMatch(/.+/);
    expect(saved.dateLabel).toBe('Agora');
    expect(saved.dismissed).toBe(false);
    expect(await repo.getById(saved.id)).toEqual(saved);
  });

  test('keeps a provided id and dateLabel', async () => {
    const saved = await createNotice(fakeRepo(), draft({ id: 'n-1', dateLabel: 'Ontem' }));
    expect(saved.id).toBe('n-1');
    expect(saved.dateLabel).toBe('Ontem');
  });

  test('rejects an empty title', async () => {
    await expect(createNotice(fakeRepo(), draft({ title: '' }))).rejects.toThrow(
      NoticeValidationError,
    );
  });

  test('rejects an empty body', async () => {
    await expect(createNotice(fakeRepo(), draft({ body: '' }))).rejects.toThrow(
      NoticeValidationError,
    );
  });
});
