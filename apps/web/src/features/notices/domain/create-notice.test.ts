import { InMemoryNoticeRepository } from '../data/in-memory-notice-repository';

import { createNotice } from './create-notice';
import { NoticeValidationError } from './errors';

describe('createNotice', () => {
  test('assigns an id and defaults dateLabel and dismissed', async () => {
    const repo = new InMemoryNoticeRepository([]);

    const created = await createNotice(repo, {
      title: 'Portão da garagem',
      body: 'Técnico agendado para quinta.',
      kind: 'aviso',
      audience: 'Bloco 2',
    });

    expect(created.id).toMatch(/.+/);
    expect(created.dateLabel).toBe('Agora');
    expect(created.dismissed).toBe(false);
    expect(await repo.getById(created.id)).toEqual(created);
  });

  test('keeps a provided dateLabel', async () => {
    const repo = new InMemoryNoticeRepository([]);

    const created = await createNotice(repo, {
      title: 'Assembleia',
      body: 'Dia 20/04 às 19h.',
      kind: 'urgente',
      audience: 'Todos os moradores',
      dateLabel: 'Há 1 semana',
    });

    expect(created.dateLabel).toBe('Há 1 semana');
  });

  test('rejects a draft with an empty title', async () => {
    const repo = new InMemoryNoticeRepository([]);

    await expect(
      createNotice(repo, { title: '', body: 'corpo', kind: 'aviso', audience: 'Bloco 2' }),
    ).rejects.toBeInstanceOf(NoticeValidationError);
  });

  test('rejects a draft with an empty body', async () => {
    const repo = new InMemoryNoticeRepository([]);

    await expect(
      createNotice(repo, { title: 'titulo', body: '', kind: 'aviso', audience: 'Bloco 2' }),
    ).rejects.toBeInstanceOf(NoticeValidationError);
  });
});
