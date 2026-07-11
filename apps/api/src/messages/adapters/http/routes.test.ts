import { Hono } from 'hono';

import type { Thread } from '../../domain/message';
import type { ThreadRepository } from '../../domain/thread-repository';

import { threadRoutes } from './routes';

function fakeRepo(list: Thread[]): ThreadRepository {
  const map = new Map(list.map((t) => [t.id, t]));
  return {
    list: () => [...map.values()],
    getById: (id) => map.get(id) ?? null,
    save: (t) => {
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

function mount(repo: ThreadRepository) {
  const app = new Hono();
  app.route('/threads', threadRoutes(repo));
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
