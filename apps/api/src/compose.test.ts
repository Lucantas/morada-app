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
