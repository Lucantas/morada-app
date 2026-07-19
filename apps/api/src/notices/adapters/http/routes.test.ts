import { Hono } from 'hono';

import type { ApiEnv, Role } from '../../../platform/auth';
import type { Notice } from '../../domain/notice';
import type { NoticeRepository } from '../../domain/notice-repository';

import { noticeRoutes } from './routes';

function fakeRepo(list: Notice[] = []): NoticeRepository {
  const map = new Map(list.map((n) => [n.id, n]));
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

function mount(repo: NoticeRepository, role: Role = 'admin') {
  const app = new Hono<ApiEnv>();
  app.use('*', async (c, next) => {
    c.set('role', role);
    c.set('sub', 'admin');
    await next();
  });
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
    expect(await repo.getById(body.id)).not.toBeNull();
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
    expect(await repo.getById('n-1')).toBeNull();
  });

  test('POST / is forbidden for non-admins', async () => {
    const app = mount(fakeRepo(), 'resident');
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
    expect(res.status).toBe(403);
  });

  test('DELETE /:id is forbidden for non-admins', async () => {
    const repo = fakeRepo([build({ id: 'n-1' })]);
    const app = mount(repo, 'resident');
    const res = await app.request('/notices/n-1', { method: 'DELETE' });
    expect(res.status).toBe(403);
    expect(await repo.getById('n-1')).not.toBeNull();
  });
});
