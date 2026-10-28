import { Hono } from 'hono';

import type { ApiEnv, Role } from '../../../platform/auth';
import type { Thread } from '../../domain/message';
import type { ThreadRepository } from '../../domain/thread-repository';
import { inMemoryThreads as fakeRepo } from '../../../test-support/in-memory-threads';

import { threadRoutes, type ThreadResidentLookup } from './routes';

const build = (over: Partial<Thread>): Thread => ({
  id: 't-1',
  residentName: 'Ana',
  apt: 'Apto 1',
  residentId: null,
  apartmentId: null,
  unread: false,
  messages: [],
  ...over,
});

function mount(
  repo: ThreadRepository,
  lookup: ThreadResidentLookup = async () => ({
    name: 'Morador',
    apt: 'Apto',
    apartmentId: 'ap-1',
  }),
  role: Role = 'admin',
  uid = 'u-admin',
) {
  const app = new Hono<ApiEnv>();
  app.use('*', async (c, next) => {
    c.set('role', role);
    c.set('sub', 't-1');
    c.set('uid', uid);
    await next();
  });
  app.route(
    '/threads',
    threadRoutes(
      () => ({ threads: repo }),
      () => lookup,
    ),
  );
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
    const app = mount(fakeRepo([]), async () => ({
      name: 'Maria',
      apt: 'Apto 302',
      apartmentId: 'ap-302',
    }));
    const res = await app.request('/threads/r-1');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Thread;
    expect(body).toMatchObject({
      id: 'r-1',
      residentName: 'Maria',
      residentId: 'r-1',
      apartmentId: 'ap-302',
      messages: [],
    });
  });

  test('POST /:id/messages creates the thread on the first message', async () => {
    const repo = fakeRepo([]);
    const app = mount(repo, async () => ({
      name: 'Maria',
      apt: 'Apto 302',
      apartmentId: 'ap-302',
    }));
    const res = await app.request('/threads/r-1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Primeira mensagem' }),
    });
    expect(res.status).toBe(200);
    expect((await repo.getById('r-1', 'u-admin'))?.messages).toHaveLength(1);
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

  test('POST /:id/read clears unread for the caller', async () => {
    const app = mount(fakeRepo([build({ id: 't-1', unread: true })]));
    const res = await app.request('/threads/t-1/read', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Thread;
    expect(body.unread).toBe(false);
  });

  test('POST /:id/read by the resident does not make the thread read for the admin', async () => {
    const repo = fakeRepo([build({ id: 't-1', unread: true })]);
    const asResident = mount(repo, undefined, 'resident', 'u-resident');

    const res = await asResident.request('/threads/t-1/read', { method: 'POST' });

    expect(res.status).toBe(200);
    const listRes = await mount(repo).request('/threads');
    const list = (await listRes.json()) as Thread[];
    expect(list[0]?.unread).toBe(true);
  });
});
