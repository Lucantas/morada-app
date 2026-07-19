import { Hono } from 'hono';

import type { ApiEnv, Role } from '../../../platform/auth';
import type { Notice } from '../../domain/notice';
import type { NoticeRepository } from '../../domain/notice-repository';

import { noticeRoutes } from './routes';

function fakeRepo(list: Notice[] = []): NoticeRepository {
  const map = new Map(list.map((n) => [n.id, n]));
  const dismissals = new Set<string>();
  return {
    list: async (viewerResidentId) =>
      [...map.values()].map((n) => ({
        ...n,
        dismissed: viewerResidentId !== null && dismissals.has(`${n.id}:${viewerResidentId}`),
      })),
    getById: async (id) => map.get(id) ?? null,
    save: async (n) => {
      const saved = { ...n, dismissed: false };
      map.set(n.id, saved);
      return saved;
    },
    dismiss: async (id, residentId) => {
      const notice = map.get(id);
      if (!notice) throw new Error('not found');
      dismissals.add(`${id}:${residentId}`);
      return { ...notice, dismissed: true };
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

function mount(repo: NoticeRepository, role: Role = 'admin', sub = 'admin') {
  const app = new Hono<ApiEnv>();
  app.use('*', async (c, next) => {
    c.set('role', role);
    c.set('sub', sub);
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

  test('POST /:id/dismiss flips dismissed to true for the dismissing resident', async () => {
    const app = mount(fakeRepo([build({ id: 'n-1', dismissed: false })]), 'resident', 'resident-a');
    const res = await app.request('/notices/n-1/dismiss', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Notice;
    expect(body.dismissed).toBe(true);
  });

  test('dismissing a notice as one resident does not hide it for another resident or the admin', async () => {
    const repo = fakeRepo([build({ id: 'n-1', dismissed: false })]);
    const appA = mount(repo, 'resident', 'resident-a');
    const appB = mount(repo, 'resident', 'resident-b');
    const appAdmin = mount(repo, 'admin', 'admin');

    await appA.request('/notices/n-1/dismiss', { method: 'POST' });

    const bodyA = (await (await appA.request('/notices')).json()) as Notice[];
    const bodyB = (await (await appB.request('/notices')).json()) as Notice[];
    const bodyAdmin = (await (await appAdmin.request('/notices')).json()) as Notice[];

    expect(bodyA.find((n) => n.id === 'n-1')?.dismissed).toBe(true);
    expect(bodyB.find((n) => n.id === 'n-1')?.dismissed).toBe(false);
    expect(bodyAdmin.find((n) => n.id === 'n-1')?.dismissed).toBe(false);
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
