import { Hono } from 'hono';

import type { Notice } from '../../domain/notice';
import type { NoticeRepository } from '../../domain/notice-repository';

import { noticeRoutes } from './routes';

function fakeRepo(list: Notice[] = []): NoticeRepository {
  const map = new Map(list.map((n) => [n.id, n]));
  return {
    list: () => [...map.values()],
    getById: (id) => map.get(id) ?? null,
    save: (n) => {
      map.set(n.id, n);
      return n;
    },
    remove: (id) => {
      map.delete(id);
    },
  };
}

const build = (over: Partial<Notice>): Notice => ({
  id: 'n-1',
  title: 'Título',
  body: 'Mensagem',
  kind: 'aviso',
  audience: 'todos',
  dateLabel: 'Agora',
  dismissed: false,
  ...over,
});

function mount(repo: NoticeRepository) {
  const app = new Hono();
  app.route('/notices', noticeRoutes(repo));
  return app;
}

describe('noticeRoutes', () => {
  test('GET / lists notices', async () => {
    const app = mount(fakeRepo([build({ id: 'a' }), build({ id: 'b' })]));
    const res = await app.request('/notices');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Notice[];
    expect(body.map((n) => n.id)).toEqual(['a', 'b']);
  });

  test('POST / creates a notice with 201', async () => {
    const repo = fakeRepo();
    const app = mount(repo);
    const res = await app.request('/notices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Novo aviso',
        body: 'Mensagem',
        kind: 'aviso',
        audience: 'todos',
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as Notice;
    expect(body.id).toMatch(/.+/);
    expect(repo.getById(body.id)).not.toBeNull();
  });

  test('POST /:id/dismiss flips dismissed to true', async () => {
    const app = mount(fakeRepo([build({ id: 'n-1', dismissed: false })]));
    const res = await app.request('/notices/n-1/dismiss', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Notice;
    expect(body.dismissed).toBe(true);
  });

  test('DELETE /:id returns 204', async () => {
    const repo = fakeRepo([build({ id: 'n-1' })]);
    const app = mount(repo);
    const res = await app.request('/notices/n-1', { method: 'DELETE' });
    expect(res.status).toBe(204);
    expect(repo.getById('n-1')).toBeNull();
  });
});
