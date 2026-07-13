import { buildApp } from './compose';
import { createTestDb } from './platform/db';
import { demoCredentials } from './seed-data';

function makeApp() {
  return buildApp(createTestDb());
}

async function login(
  app: ReturnType<typeof buildApp>,
  username: string,
  password: string,
): Promise<Response> {
  return app.request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

async function tokenFor(
  app: ReturnType<typeof buildApp>,
  creds: { username: string; password: string },
): Promise<string> {
  const res = await login(app, creds.username, creds.password);
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
    const token = await tokenFor(app, demoCredentials.resident);
    const res = await app.request('/api/residents', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  test('lets an admin list seeded residents', async () => {
    const app = makeApp();
    const token = await tokenFor(app, demoCredentials.admin);
    const res = await app.request('/api/residents', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const residents = (await res.json()) as unknown[];
    expect(residents).toHaveLength(7);
  });

  test('an admin can create a resident (201) and read it back', async () => {
    const app = makeApp();
    const token = await tokenFor(app, demoCredentials.admin);
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

  test('rejects a login missing the password with 400', async () => {
    const res = await makeApp().request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('Morada API — real credentials', () => {
  test('valid demo credentials return a token and role', async () => {
    const res = await login(
      makeApp(),
      demoCredentials.admin.username,
      demoCredentials.admin.password,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; role: string };
    expect(body.token).toMatch(/.+/);
    expect(body.role).toBe('admin');
  });

  test('a wrong password is rejected with 401', async () => {
    const res = await login(makeApp(), demoCredentials.admin.username, 'senha-errada');
    expect(res.status).toBe(401);
  });

  test('an unknown username is rejected with 401', async () => {
    const res = await login(makeApp(), 'ninguem', demoCredentials.admin.password);
    expect(res.status).toBe(401);
  });

  test('a resident reads their own record via GET /api/residents/me', async () => {
    const app = makeApp();
    const token = await tokenFor(app, demoCredentials.resident);
    const res = await app.request('/api/residents/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const me = (await res.json()) as { id: string; name: string };
    expect(me.id).toBe(demoCredentials.resident.residentId);
    expect(me.name).toBe('Maria Ribeiro');
  });

  test('GET /api/residents/me still requires authentication', async () => {
    const res = await makeApp().request('/api/residents/me');
    expect(res.status).toBe(401);
  });

  test("a resident token is scoped to that resident's own id", async () => {
    const app = makeApp();
    const token = await tokenFor(app, demoCredentials.resident);
    const auth = (path: string) =>
      app.request(path, { headers: { Authorization: `Bearer ${token}` } });

    const own = await auth(`/api/threads/${demoCredentials.resident.residentId}`);
    expect(own.status).toBe(200);

    const foreign = await auth('/api/threads/t-2');
    expect(foreign.status).toBe(403);
  });
});

describe('Morada API — admin provisions resident logins', () => {
  async function adminAuth(app: ReturnType<typeof buildApp>) {
    const token = await tokenFor(app, demoCredentials.admin);
    return (path: string, init: RequestInit = {}) =>
      app.request(path, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
  }

  test('an admin creates a login and the new resident can log in with the temp password', async () => {
    const app = makeApp();
    const auth = await adminAuth(app);

    const created = await auth('/api/users', {
      method: 'POST',
      body: JSON.stringify({ username: 'ana202', residentId: 'r-3' }),
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as { username: string; tempPassword: string };
    expect(body.username).toBe('ana202');
    expect(body.tempPassword).toMatch(/.{8,}/);

    const loginRes = await login(app, 'ana202', body.tempPassword);
    expect(loginRes.status).toBe(200);
    expect(((await loginRes.json()) as { role: string }).role).toBe('resident');
  });

  test('provisioning a resident login is admin-only', async () => {
    const app = makeApp();
    const token = await tokenFor(app, demoCredentials.resident);
    const res = await app.request('/api/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'hacker', residentId: 'r-4' }),
    });
    expect(res.status).toBe(403);
  });

  test('provisioning a duplicate username is rejected with 409', async () => {
    const app = makeApp();
    const auth = await adminAuth(app);
    const res = await auth('/api/users', {
      method: 'POST',
      body: JSON.stringify({ username: demoCredentials.resident.username, residentId: 'r-5' }),
    });
    expect(res.status).toBe(409);
  });

  test('provisioning for a nonexistent resident is rejected with 404', async () => {
    const app = makeApp();
    const auth = await adminAuth(app);
    const res = await auth('/api/users', {
      method: 'POST',
      body: JSON.stringify({ username: 'fantasma', residentId: 'r-does-not-exist' }),
    });
    expect(res.status).toBe(404);
  });

  test('provisioning a second login for the same resident is rejected with 409', async () => {
    const app = makeApp();
    const auth = await adminAuth(app);
    const res = await auth('/api/users', {
      method: 'POST',
      body: JSON.stringify({
        username: 'maria-alt',
        residentId: demoCredentials.resident.residentId,
      }),
    });
    expect(res.status).toBe(409);
  });
});

describe('Morada API — authorization wiring', () => {
  async function withCreds(creds: { username: string; password: string }) {
    const app = makeApp();
    const token = await tokenFor(app, creds);
    const auth = (path: string, init: RequestInit = {}) =>
      app.request(path, {
        ...init,
        headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
      });
    return { app, auth };
  }

  test('accounts are admin-only', async () => {
    const resident = await withCreds(demoCredentials.resident);
    expect((await resident.auth('/api/accounts')).status).toBe(403);
    const admin = await withCreds(demoCredentials.admin);
    expect((await admin.auth('/api/accounts')).status).toBe(200);
  });

  test('receipts and dashboard are open to any authenticated user', async () => {
    const { auth } = await withCreds(demoCredentials.resident);
    expect((await auth('/api/receipts')).status).toBe(200);
    expect((await auth('/api/dashboard')).status).toBe(200);
  });

  test('a resident lists only their own receipts', async () => {
    const { auth } = await withCreds(demoCredentials.resident); // r-1
    const res = await auth('/api/receipts');
    const receipts = (await res.json()) as { id: string; residentId?: string }[];
    expect(receipts.length).toBeGreaterThan(0);
    expect(receipts.every((r) => r.residentId === 'r-1')).toBe(true);
    expect(receipts.some((r) => r.id === 'rc-5')).toBe(false); // rc-5 belongs to r-3
  });

  test('a resident cannot read or pay another resident receipt (403)', async () => {
    const { auth } = await withCreds(demoCredentials.resident); // r-1
    expect((await auth('/api/receipts/rc-5')).status).toBe(403); // rc-5 is r-3's
    const pay = await auth('/api/receipts/rc-5/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'pix' }),
    });
    expect(pay.status).toBe(403);
  });

  test('a resident can pay their own receipt', async () => {
    const { auth } = await withCreds(demoCredentials.resident); // r-1 owns rc-1
    const pay = await auth('/api/receipts/rc-1/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'pix' }),
    });
    expect(pay.status).toBe(200);
    expect(((await pay.json()) as { status: string }).status).toBe('pago');
  });

  test('notices are readable by residents but writable only by admins', async () => {
    const resident = await withCreds(demoCredentials.resident);
    expect((await resident.auth('/api/notices')).status).toBe(200);
    const write = (a: typeof resident.auth) =>
      a('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Aviso', body: 'Corpo', kind: 'aviso', audience: 'Todos' }),
      });
    expect((await write(resident.auth)).status).toBe(403);
    const admin = await withCreds(demoCredentials.admin);
    expect((await write(admin.auth)).status).toBe(201);
  });

  test('a resident can dismiss a notice but cannot delete one', async () => {
    const { auth } = await withCreds(demoCredentials.resident);
    expect((await auth('/api/notices/n-1/dismiss', { method: 'POST' })).status).toBe(200);
    expect((await auth('/api/notices/n-1', { method: 'DELETE' })).status).toBe(403);
  });

  test('listing all threads is admin-only, but a resident can read their own thread', async () => {
    const resident = await withCreds(demoCredentials.resident);
    expect((await resident.auth('/api/threads')).status).toBe(403);
    expect(
      (await resident.auth(`/api/threads/${demoCredentials.resident.residentId}`)).status,
    ).toBe(200);
    const admin = await withCreds(demoCredentials.admin);
    expect((await admin.auth('/api/threads')).status).toBe(200);
  });

  test('a resident cannot read or write another resident thread (IDOR blocked)', async () => {
    const { auth } = await withCreds(demoCredentials.resident);
    expect((await auth('/api/threads/t-2')).status).toBe(403);
    const post = await auth('/api/threads/t-2/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'intruso' }),
    });
    expect(post.status).toBe(403);
  });

  test('message author is derived from the token role, not the request body', async () => {
    const { auth } = await withCreds(demoCredentials.resident);
    const res = await auth(`/api/threads/${demoCredentials.resident.residentId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: 'admin', text: 'tentativa de spoof' }),
    });
    expect(res.status).toBe(200);
    const thread = (await res.json()) as { messages: { author: string; text: string }[] };
    const last = thread.messages[thread.messages.length - 1];
    expect(last?.author).toBe('resident');
  });
});
