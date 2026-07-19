import { Hono } from 'hono';

import type { ApiEnv, Role } from '../../../platform/auth';
import type { Thread } from '../../domain/message';
import type { ThreadRepository } from '../../domain/thread-repository';

import { threadRoutes } from './routes';

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
  id: 't-1',
  residentName: 'Ana',
  apt: 'Apto 1',
  unread: false,
  messages: [],
  ...over,
});

function mount(
  repo: ThreadRepository,
  lookup: (id: string) => Promise<{ name: string; apt: string } | null> = async () => ({
    name: 'Morador',
    apt: 'Apto',
  }),
  role: Role = 'admin',
) {
  const app = new Hono<ApiEnv>();
  app.use('*', async (c, next) => {
    c.set('role', role);
    c.set('sub', 't-1');
    await next();
  });
  app.route('/threads', threadRoutes(repo, lookup));
  return app;
}

describe('threadRoutes', () => {
  test('GET / lists threads', async () => {
    const app = mount(fakeRepo([build({ id: 't-1', residentName: 'Ana' })]));
    const res = await app.request('/threads');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Thread[];
    expect(body).toHaveLength(1);
    expect(body[0]?.residentName).toBe('Ana');
  });

  test('GET / is forbidden for non-admins', async () => {
    const app = mount(fakeRepo([build({ id: 't-1' })]), undefined, 'resident');
    const res = await app.request('/threads');
    expect(res.status).toBe(403);
  });

  test('GET /:id materialises an empty thread when none exists yet', async () => {
    const app = mount(fakeRepo([]), async () => ({ name: 'Maria', apt: 'Apto 302' }));
    const res = await app.request('/threads/r-1');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Thread;
    expect(body).toMatchObject({ id: 'r-1', residentName: 'Maria', messages: [] });
  });

  test('POST /:id/messages creates the thread on the first message', async () => {
    const repo = fakeRepo([]);
    const app = mount(repo, async () => ({ name: 'Maria', apt: 'Apto 302' }));
    const res = await app.request('/threads/r-1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Primeira mensagem' }),
    });
    expect(res.status).toBe(200);
    expect((await repo.getById('r-1'))?.messages).toHaveLength(1);
  });

  test('POST /:id/messages appends a message', async () => {
    const app = mount(fakeRepo([build({ id: 't-1', messages: [] })]));
    const res = await app.request('/threads/t-1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: 'admin', text: 'Olá' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Thread;
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]?.text).toBe('Olá');
  });

  test('POST /:id/read clears unread', async () => {
    const app = mount(fakeRepo([build({ id: 't-1', unread: true })]));
    const res = await app.request('/threads/t-1/read', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Thread;
    expect(body.unread).toBe(false);
  });
});
