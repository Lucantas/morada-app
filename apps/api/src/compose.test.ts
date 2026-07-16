import { buildApp } from './compose';
import { config } from './platform/config';
import { migrate } from './platform/postgres/migrate';
import { createPool } from './platform/postgres/pool';
import { makePostgresRepositories } from './platform/repositories';
import { adminCredentials } from './seed-data';
import { resetPg } from './test-support/pg';
import { residentCredentials, seedFixtures } from './test-fixtures';

const pool = createPool(config.databaseUrl);

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

type App = Awaited<ReturnType<typeof buildApp>>;

// Each call resets to a fresh seeded state, so a test may build more than one app
// (e.g. one per credential) against the shared Postgres without id collisions.
async function makeApp(): Promise<App> {
  await resetPg(pool);
  const app = await buildApp(makePostgresRepositories(pool));
  await seedFixtures(pool);
  return app;
}

async function login(app: App, username: string, password: string): Promise<Response> {
  return app.request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

async function tokenFor(app: App, creds: { username: string; password: string }): Promise<string> {
  const res = await login(app, creds.username, creds.password);
  const body = (await res.json()) as { token: string };
  return body.token;
}

describe('Morada API', () => {
  test('health check responds ok', async () => {
    const res = await (await makeApp()).request('/healthz');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  test('rejects unauthenticated access to protected resources', async () => {
    const res = await (await makeApp()).request('/api/residents');
    expect(res.status).toBe(401);
  });

  test('forbids a resident from admin-only resources', async () => {
    const app = await makeApp();
    const token = await tokenFor(app, residentCredentials);
    const res = await app.request('/api/residents', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  test('lets an admin list seeded residents', async () => {
    const app = await makeApp();
    const token = await tokenFor(app, adminCredentials);
    const res = await app.request('/api/residents', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const residents = (await res.json()) as unknown[];
    expect(residents).toHaveLength(7);
  });

  test('an admin can create a resident (201) and read it back', async () => {
    const app = await makeApp();
    const token = await tokenFor(app, adminCredentials);
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

  test('an admin overrides and then clears a resident status', async () => {
    const app = await makeApp();
    const token = await tokenFor(app, adminCredentials);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const override = await app.request(`/api/residents/${residentCredentials.residentId}/status`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status: 'atrasado' }),
    });
    expect(override.status).toBe(200);

    const clear = await app.request(`/api/residents/${residentCredentials.residentId}/status`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status: null }),
    });
    expect(clear.status).toBe(200);
  });

  test('overriding a resident status is admin-only', async () => {
    const app = await makeApp();
    const token = await tokenFor(app, residentCredentials);
    const res = await app.request(`/api/residents/${residentCredentials.residentId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'atrasado' }),
    });
    expect(res.status).toBe(403);
  });

  test('rejects a login missing the password with 400', async () => {
    const res = await (
      await makeApp()
    ).request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('Morada API — real credentials', () => {
  test('valid demo credentials return a token and role', async () => {
    const res = await login(await makeApp(), adminCredentials.username, adminCredentials.password);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; role: string };
    expect(body.token).toMatch(/.+/);
    expect(body.role).toBe('admin');
  });

  test('a wrong password is rejected with 401', async () => {
    const res = await login(await makeApp(), adminCredentials.username, 'senha-errada');
    expect(res.status).toBe(401);
  });

  test('an unknown username is rejected with 401', async () => {
    const res = await login(await makeApp(), 'ninguem', adminCredentials.password);
    expect(res.status).toBe(401);
  });

  test('a resident reads their own record via GET /api/residents/me', async () => {
    const app = await makeApp();
    const token = await tokenFor(app, residentCredentials);
    const res = await app.request('/api/residents/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const me = (await res.json()) as { id: string; name: string };
    expect(me.id).toBe(residentCredentials.residentId);
    expect(me.name).toBe('Maria Ribeiro');
  });

  test('GET /api/residents/me still requires authentication', async () => {
    const res = await (await makeApp()).request('/api/residents/me');
    expect(res.status).toBe(401);
  });

  test("a resident token is scoped to that resident's own id", async () => {
    const app = await makeApp();
    const token = await tokenFor(app, residentCredentials);
    const auth = (path: string) =>
      app.request(path, { headers: { Authorization: `Bearer ${token}` } });

    const own = await auth(`/api/threads/${residentCredentials.residentId}`);
    expect(own.status).toBe(200);

    const foreign = await auth('/api/threads/t-2');
    expect(foreign.status).toBe(403);
  });
});

async function adminAuthFor(app: App) {
  const token = await tokenFor(app, adminCredentials);
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

describe('Morada API — apartments & occupancy', () => {
  const resident = (apt: string, name: string) =>
    JSON.stringify({ name, apt, phone: '', email: '', status: 'em_dia' });

  test('rejects a second active resident in an occupied apartment (409)', async () => {
    const app = await makeApp();
    const auth = await adminAuthFor(app);
    expect(
      (await auth('/api/residents', { method: 'POST', body: resident('Apto 999', 'A') })).status,
    ).toBe(201);
    const second = await auth('/api/residents', {
      method: 'POST',
      body: resident('Apto 999', 'B'),
    });
    expect(second.status).toBe(409);
  });

  test('a resident can be moved out, freeing the apartment for the next', async () => {
    const app = await makeApp();
    const auth = await adminAuthFor(app);
    const first = await auth('/api/residents', { method: 'POST', body: resident('Apto 888', 'A') });
    const { id } = (await first.json()) as { id: string };

    expect((await auth(`/api/residents/${id}/deactivate`, { method: 'POST' })).status).toBe(204);
    // now the apartment is free again
    const next = await auth('/api/residents', { method: 'POST', body: resident('Apto 888', 'B') });
    expect(next.status).toBe(201);
    // the active-residents list shows the new occupant, not the old one
    const listed = (await (await auth('/api/residents')).json()) as { name: string; apt: string }[];
    const at888 = listed.filter((r) => r.apt === 'Apto 888');
    expect(at888.map((r) => r.name)).toEqual(['B']);
  });

  test("an admin reads an apartment's occupant history (current + former, active-first)", async () => {
    const app = await makeApp();
    const auth = await adminAuthFor(app);
    const first = await auth('/api/residents', { method: 'POST', body: resident('Apto 777', 'A') });
    const { id, apartmentId } = (await first.json()) as { id: string; apartmentId: string };
    expect((await auth(`/api/residents/${id}/deactivate`, { method: 'POST' })).status).toBe(204);
    await auth('/api/residents', { method: 'POST', body: resident('Apto 777', 'B') });

    const res = await auth(`/api/apartments/${apartmentId}/residents`);
    expect(res.status).toBe(200);
    const history = (await res.json()) as { name: string; active: boolean }[];
    expect(history.map((r) => r.name).sort()).toEqual(['A', 'B']);
    expect(history[0]?.name).toBe('B'); // active occupant first
    expect(history[0]?.active).toBe(true);
  });

  test('the apartment occupant history is admin-only', async () => {
    const app = await makeApp();
    const token = await tokenFor(app, residentCredentials);
    const res = await app.request('/api/apartments/apt-r-1/residents', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  test("an admin reads an apartment's full receipt ledger", async () => {
    const app = await makeApp();
    const auth = await adminAuthFor(app);
    // fixtures seed r-1 (Apto 302) with receipts under apartment apt-r-1
    const res = await auth('/api/apartments/apt-r-1/receipts');
    expect(res.status).toBe(200);
    const receipts = (await res.json()) as { residentId: string }[];
    expect(receipts.length).toBeGreaterThan(0);
    expect(receipts.every((r) => r.residentId === 'r-1')).toBe(true);
  });

  test('the apartment ledger is admin-only', async () => {
    const app = await makeApp();
    const token = await tokenFor(app, residentCredentials);
    const res = await app.request('/api/apartments/apt-r-1/receipts', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });
});

describe('Morada API — admin provisions resident logins', () => {
  const adminAuth = adminAuthFor;

  test('an admin creates a login and the new resident can log in with the temp password', async () => {
    const app = await makeApp();
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
    const app = await makeApp();
    const token = await tokenFor(app, residentCredentials);
    const res = await app.request('/api/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'hacker', residentId: 'r-4' }),
    });
    expect(res.status).toBe(403);
  });

  test('provisioning a duplicate username is rejected with 409', async () => {
    const app = await makeApp();
    const auth = await adminAuth(app);
    const res = await auth('/api/users', {
      method: 'POST',
      body: JSON.stringify({ username: residentCredentials.username, residentId: 'r-5' }),
    });
    expect(res.status).toBe(409);
  });

  test('provisioning for a nonexistent resident is rejected with 404', async () => {
    const app = await makeApp();
    const auth = await adminAuth(app);
    const res = await auth('/api/users', {
      method: 'POST',
      body: JSON.stringify({ username: 'fantasma', residentId: 'r-does-not-exist' }),
    });
    expect(res.status).toBe(404);
  });

  test('provisioning a second login for the same resident is rejected with 409', async () => {
    const app = await makeApp();
    const auth = await adminAuth(app);
    const res = await auth('/api/users', {
      method: 'POST',
      body: JSON.stringify({
        username: 'maria-alt',
        residentId: residentCredentials.residentId,
      }),
    });
    expect(res.status).toBe(409);
  });
});

describe('Morada API — authorization wiring', () => {
  async function withCreds(creds: { username: string; password: string }) {
    const app = await makeApp();
    const token = await tokenFor(app, creds);
    const auth = (path: string, init: RequestInit = {}) =>
      app.request(path, {
        ...init,
        headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
      });
    return { app, auth };
  }

  test('accounts are admin-only', async () => {
    const resident = await withCreds(residentCredentials);
    expect((await resident.auth('/api/accounts')).status).toBe(403);
    const admin = await withCreds(adminCredentials);
    expect((await admin.auth('/api/accounts')).status).toBe(200);
  });

  test('settings are admin-only', async () => {
    const resident = await withCreds(residentCredentials);
    expect((await resident.auth('/api/settings')).status).toBe(403);
    const admin = await withCreds(adminCredentials);
    const res = await admin.auth('/api/settings');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ monthlyFeeCents: 15000, dueDay: 15 });
  });

  test('categories are admin-only; saving reclassifies matching accounts', async () => {
    const resident = await withCreds(residentCredentials);
    expect((await resident.auth('/api/categories')).status).toBe(403);

    const admin = await withCreds(adminCredentials);
    const list = await admin.auth('/api/categories');
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual([]);

    // fixtures seed account a-1 with description "Água — abril" — matched by keyword "água"
    const put = await admin.auth('/api/categories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ name: 'Água', keywords: 'água' }]),
    });
    expect(put.status).toBe(200);
    const body = (await put.json()) as {
      categories: { name: string; keywords: string }[];
      reclassified: number;
    };
    expect(body.categories).toEqual([
      { id: expect.any(String), name: 'Água', keywords: 'água', position: 0 },
    ]);
    expect(body.reclassified).toBe(1);

    const accounts = await admin.auth('/api/accounts');
    const list2 = (await accounts.json()) as { id: string; category: string }[];
    expect(list2.find((a) => a.id === 'a-1')?.category).toBe('Água');
  });

  test('receipts and dashboard are open to any authenticated user', async () => {
    const { auth } = await withCreds(residentCredentials);
    expect((await auth('/api/receipts')).status).toBe(200);
    expect((await auth('/api/dashboard')).status).toBe(200);
  });

  test('a resident lists only their own receipts', async () => {
    const { auth } = await withCreds(residentCredentials); // r-1
    const res = await auth('/api/receipts');
    const receipts = (await res.json()) as { id: string; residentId?: string }[];
    expect(receipts.length).toBeGreaterThan(0);
    expect(receipts.every((r) => r.residentId === 'r-1')).toBe(true);
    expect(receipts.some((r) => r.id === 'rc-5')).toBe(false); // rc-5 belongs to r-3
  });

  test('a resident cannot read or pay another resident receipt (403)', async () => {
    const { auth } = await withCreds(residentCredentials); // r-1
    expect((await auth('/api/receipts/rc-5')).status).toBe(403); // rc-5 is r-3's
    const pay = await auth('/api/receipts/rc-5/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'pix' }),
    });
    expect(pay.status).toBe(403);
  });

  test('a resident cannot pay their own receipt directly (admin-only)', async () => {
    const { auth } = await withCreds(residentCredentials); // r-1 owns rc-1
    const pay = await auth('/api/receipts/rc-1/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'pix' }),
    });
    expect(pay.status).toBe(403);
  });

  test('a resident submits a payment with proof for their own receipt, moving it to em_analise', async () => {
    const { auth } = await withCreds(residentCredentials); // r-1 owns rc-1
    const submit = await auth('/api/receipts/rc-1/submit-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'pix',
        proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      }),
    });
    expect(submit.status).toBe(200);
    const body = (await submit.json()) as { status: string; submittedAt?: string };
    expect(body.status).toBe('em_analise');
    expect(body.submittedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('an admin issues a charge and the resident then sees it (pending)', async () => {
    const app = await makeApp();
    const adminToken = await tokenFor(app, adminCredentials);
    const issue = await app.request('/api/receipts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        residentId: 'r-1',
        ref: '05/2026',
        title: 'Taxa condominial',
        valueCents: 45000,
        dueDate: '2026-05-10',
      }),
    });
    expect(issue.status).toBe(201);
    const created = (await issue.json()) as { id: string; status: string };
    expect(created.status).toBe('pendente');

    const residentToken = await tokenFor(app, residentCredentials);
    const mine = await app.request('/api/receipts', {
      headers: { Authorization: `Bearer ${residentToken}` },
    });
    const ids = ((await mine.json()) as { id: string }[]).map((r) => r.id);
    expect(ids).toContain(created.id);
  });

  test('issuing a charge is admin-only', async () => {
    const app = await makeApp();
    const token = await tokenFor(app, residentCredentials);
    const res = await app.request('/api/receipts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        residentId: 'r-1',
        ref: '05/2026',
        title: 'Taxa',
        valueCents: 1000,
        dueDate: '2026-05-10',
      }),
    });
    expect(res.status).toBe(403);
  });

  test('issuing a charge for a nonexistent resident is rejected with 404', async () => {
    const app = await makeApp();
    const token = await tokenFor(app, adminCredentials);
    const res = await app.request('/api/receipts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        residentId: 'r-nope',
        ref: '05/2026',
        title: 'Taxa',
        valueCents: 1000,
        dueDate: '2026-05-10',
      }),
    });
    expect(res.status).toBe(404);
  });

  test('notices are readable by residents but writable only by admins', async () => {
    const resident = await withCreds(residentCredentials);
    expect((await resident.auth('/api/notices')).status).toBe(200);
    const write = (a: typeof resident.auth) =>
      a('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Aviso', body: 'Corpo', kind: 'aviso', audience: 'Todos' }),
      });
    expect((await write(resident.auth)).status).toBe(403);
    const admin = await withCreds(adminCredentials);
    expect((await write(admin.auth)).status).toBe(201);
  });

  test('a resident can dismiss a notice but cannot delete one', async () => {
    const { auth } = await withCreds(residentCredentials);
    expect((await auth('/api/notices/n-1/dismiss', { method: 'POST' })).status).toBe(200);
    expect((await auth('/api/notices/n-1', { method: 'DELETE' })).status).toBe(403);
  });

  test('listing all threads is admin-only, but a resident can read their own thread', async () => {
    const resident = await withCreds(residentCredentials);
    expect((await resident.auth('/api/threads')).status).toBe(403);
    expect((await resident.auth(`/api/threads/${residentCredentials.residentId}`)).status).toBe(
      200,
    );
    const admin = await withCreds(adminCredentials);
    expect((await admin.auth('/api/threads')).status).toBe(200);
  });

  test('a resident cannot read or write another resident thread (IDOR blocked)', async () => {
    const { auth } = await withCreds(residentCredentials);
    expect((await auth('/api/threads/t-2')).status).toBe(403);
    const post = await auth('/api/threads/t-2/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'intruso' }),
    });
    expect(post.status).toBe(403);
  });

  test('message author is derived from the token role, not the request body', async () => {
    const { auth } = await withCreds(residentCredentials);
    const res = await auth(`/api/threads/${residentCredentials.residentId}/messages`, {
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
