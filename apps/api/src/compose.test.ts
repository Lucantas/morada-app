import { buildApp } from './compose';
import { createTestDb } from './platform/db';

function makeApp() {
  return buildApp(createTestDb());
}

async function login(
  app: ReturnType<typeof buildApp>,
  role: 'admin' | 'resident',
): Promise<string> {
  const res = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  const body = (await res.json()) as { token: string };
  return body.token;
}

describe('Morada API', () => {
  test('health check responds ok', async () => {
    const res = await makeApp().request('/healthz');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  test('rejects unauthenticated access to protected resources', async () => {
    const res = await makeApp().request('/api/residents');
    expect(res.status).toBe(401);
  });

  test('forbids a resident from admin-only resources', async () => {
    const app = makeApp();
    const token = await login(app, 'resident');
    const res = await app.request('/api/residents', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  test('lets an admin list seeded residents', async () => {
    const app = makeApp();
    const token = await login(app, 'admin');
    const res = await app.request('/api/residents', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const residents = (await res.json()) as unknown[];
    expect(residents).toHaveLength(7);
  });

  test('an admin can create a resident (201) and read it back', async () => {
    const app = makeApp();
    const token = await login(app, 'admin');
    const create = await app.request('/api/residents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Novo Morador',
        apt: 'Apto 500',
        phone: '',
        email: '',
        status: 'em_dia',
      }),
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as { id: string; name: string };
    expect(created.name).toBe('Novo Morador');

    const read = await app.request(`/api/residents/${created.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(read.status).toBe(200);
  });

  test('rejects an invalid login body with 400', async () => {
    const res = await makeApp().request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'superuser' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('Morada API — authorization wiring', () => {
  async function withRole(role: 'admin' | 'resident') {
    const app = makeApp();
    const token = await login(app, role);
    const auth = (path: string, init: RequestInit = {}) =>
      app.request(path, {
        ...init,
        headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
      });
    return { app, auth };
  }

  test('accounts are admin-only', async () => {
    const resident = await withRole('resident');
    expect((await resident.auth('/api/accounts')).status).toBe(403);
    const admin = await withRole('admin');
    expect((await admin.auth('/api/accounts')).status).toBe(200);
  });

  test('receipts and dashboard are open to any authenticated user', async () => {
    const { auth } = await withRole('resident');
    expect((await auth('/api/receipts')).status).toBe(200);
    expect((await auth('/api/dashboard')).status).toBe(200);
  });

  test('notices are readable by residents but writable only by admins', async () => {
    const resident = await withRole('resident');
    expect((await resident.auth('/api/notices')).status).toBe(200);
    const write = (a: typeof resident.auth) =>
      a('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Aviso', body: 'Corpo', kind: 'aviso', audience: 'Todos' }),
      });
    expect((await write(resident.auth)).status).toBe(403);
    const admin = await withRole('admin');
    expect((await write(admin.auth)).status).toBe(201);
  });

  test('listing all threads is admin-only, but a resident can read a single thread', async () => {
    const resident = await withRole('resident');
    expect((await resident.auth('/api/threads')).status).toBe(403);
    expect((await resident.auth('/api/threads/me')).status).toBe(200);
    const admin = await withRole('admin');
    expect((await admin.auth('/api/threads')).status).toBe(200);
  });
});
