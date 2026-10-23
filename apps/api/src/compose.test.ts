import { sign } from 'hono/jwt';

import { buildApp } from './compose';
import { config } from './platform/config';
import type { EmailSender } from './platform/email/email-sender';
import { InMemoryEmailSender } from './platform/email/in-memory-email-sender';
import { migrate } from './platform/postgres/migrate';
import { createPool } from './platform/postgres/pool';
import { makePostgresRepositories } from './repositories';
import { adminCredentials } from './seed-data';
import { resetPg } from './test-support/pg';
import { createTestCondo } from './test-support/condos';
import { BcryptPasswordHasher } from './users/adapters/bcrypt/bcrypt-password-hasher';
import { PostgresUserRepository } from './users/adapters/postgres/user-repository';
import { residentCredentials, seedFixtures, TEST_CONDO_ID } from './test-fixtures';

const P = `/api/condos/${TEST_CONDO_ID}`;

const pool = createPool(config.databaseUrl);

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

type App = Awaited<ReturnType<typeof buildApp>>;

async function count(from: string): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${from}`);
  return rows[0]?.n ?? -1;
}

// Each call resets to a fresh seeded state, so a test may build more than one app
// (e.g. one per credential) against the shared Postgres without id collisions.
async function makeApp(opts?: { email?: EmailSender; now?: () => Date }): Promise<App> {
  await resetPg(pool);
  await seedFixtures(pool);
  return buildApp(makePostgresRepositories(pool), opts);
}

async function login(app: App, username: string, password: string): Promise<Response> {
  return app.request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

async function loginWith(app: App, body: Record<string, string>): Promise<Response> {
  return app.request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function insertUser(input: {
  username: string | null;
  email: string | null;
  password: string;
}): Promise<void> {
  const hasher = new BcryptPasswordHasher(config.bcryptCost);
  await new PostgresUserRepository(pool).save({
    id: input.email === null ? `u-${input.username}` : 'u-ana',
    username: input.username,
    email: input.email,
    name: input.email === null ? null : 'Ana',
    passwordHash: await hasher.hash(input.password),
    role: 'resident',
    residentId: null,
    emailVerifiedAt: null,
    sessionVersion: 0,
  });
}

async function insertEmailUser(email: string, password: string): Promise<void> {
  await insertUser({ username: null, email, password });
}

type Auth = { cookie: string; csrf: string };

function parseCookie(setCookies: string[], name: string): string {
  const raw = setCookies.find((c) => c.startsWith(`${name}=`));
  if (!raw) throw new Error(`missing ${name} cookie`);
  const pair = raw.split(';')[0] ?? '';
  return pair.split('=').slice(1).join('=');
}

async function authFor(app: App, creds: { username: string; password: string }): Promise<Auth> {
  const res = await login(app, creds.username, creds.password);
  const setCookies = res.headers.getSetCookie();
  const session = parseCookie(setCookies, 'session');
  const csrf = parseCookie(setCookies, 'csrf');
  return { cookie: `session=${session}; csrf=${csrf}`, csrf };
}

describe('Morada API', () => {
  test('health check responds ok', async () => {
    const res = await (await makeApp()).request('/healthz');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  test('CORS allows credentials for the configured origin', async () => {
    const origin = config.webOrigins[0] ?? '';
    const res = await (
      await makeApp()
    ).request('/healthz', {
      headers: { Origin: origin },
    });
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin);
  });

  test('every response carries security headers', async () => {
    const res = await (await makeApp()).request('/healthz');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
  });

  test('rejects a mutating request without a matching CSRF token', async () => {
    const app = await makeApp();
    const auth = await authFor(app, adminCredentials);
    const res = await app.request(`${P}/accounts`, {
      method: 'POST',
      headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Água',
        category: 'Utilidades',
        valueCents: 1000,
        date: '2026-04-05',
        status: 'pendente',
      }),
    });
    expect(res.status).toBe(403);
  });

  test('accepts a mutating request with the matching CSRF token', async () => {
    const app = await makeApp();
    const auth = await authFor(app, adminCredentials);
    const res = await app.request(`${P}/accounts`, {
      method: 'POST',
      headers: {
        Cookie: auth.cookie,
        'Content-Type': 'application/json',
        'X-CSRF-Token': auth.csrf,
      },
      body: JSON.stringify({
        description: 'Água',
        category: 'Utilidades',
        valueCents: 1000,
        date: '2026-04-05',
        status: 'pendente',
      }),
    });
    expect(res.status).toBe(201);
  });

  test('rejects unauthenticated access to protected resources', async () => {
    const res = await (await makeApp()).request(`${P}/residents`);
    expect(res.status).toBe(401);
  });

  test('admin renames the condominium', async () => {
    const app = await makeApp();
    const auth = await authFor(app, adminCredentials);
    const headers = { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrf };

    const renamed = await app.request(`${P}/info`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Residencial Ipê' }),
    });
    const read = await app.request(`${P}/info`, { headers });

    expect(renamed.status).toBe(200);
    expect(await renamed.json()).toEqual({ id: TEST_CONDO_ID, name: 'Residencial Ipê' });
    expect(await read.json()).toEqual({ id: TEST_CONDO_ID, name: 'Residencial Ipê' });
  });

  test('renaming the condominium to a blank name answers 400', async () => {
    const app = await makeApp();
    const auth = await authFor(app, adminCredentials);

    const res = await app.request(`${P}/info`, {
      method: 'PUT',
      headers: {
        Cookie: auth.cookie,
        'X-CSRF-Token': auth.csrf,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: '   ' }),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Dados inválidos' });
  });

  test('renaming the condominium with a malformed body answers 400', async () => {
    const app = await makeApp();
    const auth = await authFor(app, adminCredentials);
    const headers = {
      Cookie: auth.cookie,
      'X-CSRF-Token': auth.csrf,
      'Content-Type': 'application/json',
    };

    const malformed = await app.request(`${P}/info`, { method: 'PUT', headers, body: '{nope' });
    const empty = await app.request(`${P}/info`, { method: 'PUT', headers, body: '' });

    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: 'Dados inválidos' });
    expect(empty.status).toBe(400);
  });

  test('resident reads but cannot rename the condominium (403)', async () => {
    const app = await makeApp();
    const auth = await authFor(app, residentCredentials);
    const headers = { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrf };

    const read = await app.request(`${P}/info`, { headers });
    const rename = await app.request(`${P}/info`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hack' }),
    });

    expect(read.status).toBe(200);
    expect(rename.status).toBe(403);
  });

  test('forbids a resident from admin-only resources', async () => {
    const app = await makeApp();
    const auth = await authFor(app, residentCredentials);
    const res = await app.request(`${P}/residents`, {
      headers: { Cookie: auth.cookie },
    });
    expect(res.status).toBe(403);
  });

  test('lets an admin list seeded residents', async () => {
    const app = await makeApp();
    const auth = await authFor(app, adminCredentials);
    const res = await app.request(`${P}/residents`, {
      headers: { Cookie: auth.cookie },
    });
    expect(res.status).toBe(200);
    const residents = (await res.json()) as unknown[];
    expect(residents).toHaveLength(7);
  });

  test('an admin can create a resident (201) and read it back', async () => {
    const app = await makeApp();
    const auth = await authFor(app, adminCredentials);
    const create = await app.request(`${P}/residents`, {
      method: 'POST',
      headers: {
        Cookie: auth.cookie,
        'X-CSRF-Token': auth.csrf,
        'Content-Type': 'application/json',
      },
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

    const read = await app.request(`${P}/residents/${created.id}`, {
      headers: { Cookie: auth.cookie },
    });
    expect(read.status).toBe(200);
  });

  test('cross-condo residents access answers 404', async () => {
    const app = await makeApp();
    await createTestCondo(pool, 'condo-other');
    const other = makePostgresRepositories(pool).forCondo('condo-other');
    const foreign = await other.residents.save({
      id: 'r-foreign',
      name: 'Forasteiro',
      apt: 'Apto 900',
      phone: '',
      email: '',
      status: 'em_dia',
    });
    const auth = await authFor(app, adminCredentials);
    const headers = { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrf };

    const read = await app.request(`${P}/residents/r-foreign`, { headers });
    const list = await app.request(`${P}/residents`, { headers });
    const history = await app.request(`${P}/apartments/${foreign.apartmentId}/residents`, {
      headers,
    });
    const override = await app.request(`${P}/residents/r-foreign/status`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'atrasado' }),
    });

    expect(read.status).toBe(404);
    expect(((await list.json()) as { id: string }[]).map((r) => r.id)).not.toContain('r-foreign');
    expect(await history.json()).toEqual([]);
    expect(override.status).toBe(404);
    expect((await other.residents.getById('r-foreign'))?.statusOverride).toBeNull();
  });

  async function seedForeignReceipt(): Promise<
    ReturnType<ReturnType<typeof makePostgresRepositories>['forCondo']>
  > {
    await createTestCondo(pool, 'condo-other');
    const other = makePostgresRepositories(pool).forCondo('condo-other');
    await other.receipts.save({
      id: 'rc-foreign',
      ref: '07/2026',
      title: 'Taxa condominial',
      dueDate: '2026-07-15',
      valueCents: 15000,
      status: 'em_analise',
      method: 'pix',
      submittedAt: '2026-07-14',
      residentId: 'r-foreign',
      apartmentId: 'apt-foreign',
      proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    });
    return other;
  }

  test('cross-condo receipts access answers 404', async () => {
    const app = await makeApp();
    const other = await seedForeignReceipt();
    const auth = await authFor(app, adminCredentials);
    const headers = { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrf };

    const read = await app.request(`${P}/receipts/rc-foreign`, { headers });
    const list = await app.request(`${P}/receipts`, { headers });
    const ledger = await app.request(`${P}/apartments/apt-foreign/receipts`, { headers });
    const confirm = await app.request(`${P}/receipts/rc-foreign/confirm`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const archive = await app.request(`${P}/receipts/rc-foreign`, { method: 'DELETE', headers });

    expect(read.status).toBe(404);
    expect(((await list.json()) as { id: string }[]).map((r) => r.id)).not.toContain('rc-foreign');
    expect(await ledger.json()).toEqual([]);
    expect(confirm.status).toBe(404);
    expect(archive.status).toBe(404);
    expect((await other.receipts.getById('rc-foreign'))?.status).toBe('em_analise');
  });

  test('receipt proof of another condo answers 404', async () => {
    const app = await makeApp();
    await seedForeignReceipt();
    const auth = await authFor(app, adminCredentials);

    const res = await app.request(`${P}/receipts/rc-foreign/proof`, {
      headers: { Cookie: auth.cookie },
    });

    expect(res.status).toBe(404);
  });

  async function seedForeignLedger(): Promise<
    ReturnType<ReturnType<typeof makePostgresRepositories>['forCondo']>
  > {
    await createTestCondo(pool, 'condo-other');
    const other = makePostgresRepositories(pool).forCondo('condo-other');
    await other.accounts.save({
      id: 'ac-foreign',
      description: 'Energia',
      category: 'Utilidades',
      date: '2026-07-05',
      valueCents: 5000,
      status: 'pendente',
      proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    });
    await other.incomes.save({
      id: 'in-foreign',
      description: 'Aluguel salão',
      source: 'Apto 9',
      date: '2026-07-05',
      valueCents: 15000,
    });
    return other;
  }

  test('cross-condo accounts access answers 404', async () => {
    const app = await makeApp();
    const other = await seedForeignLedger();
    const auth = await authFor(app, adminCredentials);
    const headers = { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrf };

    const read = await app.request(`${P}/accounts/ac-foreign`, { headers });
    const list = await app.request(`${P}/accounts`, { headers });
    const update = await app.request(`${P}/accounts/ac-foreign`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Hack',
        category: 'Utilidades',
        date: '2026-07-05',
        valueCents: 1,
        status: 'pago',
      }),
    });

    expect(read.status).toBe(404);
    expect(((await list.json()) as { id: string }[]).map((a) => a.id)).not.toContain('ac-foreign');
    expect(update.status).toBe(404);
    expect((await other.accounts.getById('ac-foreign'))?.description).toBe('Energia');
  });

  test('account proof of another condo answers 404', async () => {
    const app = await makeApp();
    await seedForeignLedger();
    const auth = await authFor(app, adminCredentials);

    const res = await app.request(`${P}/accounts/ac-foreign/proof`, {
      headers: { Cookie: auth.cookie },
    });

    expect(res.status).toBe(404);
  });

  test('cross-condo notices access answers 404', async () => {
    const app = await makeApp();
    await createTestCondo(pool, 'condo-other');
    const other = makePostgresRepositories(pool).forCondo('condo-other');
    await other.notices.save({
      id: 'n-foreign',
      title: 'Aviso alheio',
      body: 'Corpo',
      kind: 'aviso',
      audience: 'todos',
      dateLabel: 'Agora',
      dismissed: false,
    });
    const admin = await authFor(app, adminCredentials);
    const resident = await authFor(app, residentCredentials);
    const adminHeaders = { Cookie: admin.cookie, 'X-CSRF-Token': admin.csrf };
    const residentHeaders = { Cookie: resident.cookie, 'X-CSRF-Token': resident.csrf };

    const list = await app.request(`${P}/notices`, { headers: adminHeaders });
    const dismiss = await app.request(`${P}/notices/n-foreign/dismiss`, {
      method: 'POST',
      headers: residentHeaders,
    });
    const remove = await app.request(`${P}/notices/n-foreign`, {
      method: 'DELETE',
      headers: adminHeaders,
    });

    expect(((await list.json()) as { id: string }[]).map((n) => n.id)).not.toContain('n-foreign');
    expect(dismiss.status).toBe(404);
    expect(remove.status).toBe(404);
    expect((await other.notices.getById('n-foreign'))?.title).toBe('Aviso alheio');
    const dismissals = await pool.query('SELECT 1 FROM notice_dismissals WHERE notice_id = $1', [
      'n-foreign',
    ]);
    expect(dismissals.rowCount).toBe(0);
  });

  test('cross-condo threads access answers 404', async () => {
    const app = await makeApp();
    await createTestCondo(pool, 'condo-other');
    const other = makePostgresRepositories(pool).forCondo('condo-other');
    await other.threads.save({
      id: 'th-foreign',
      residentId: null,
      apartmentId: null,
      residentName: 'Alheio',
      apt: 'Apto 9',
      unread: false,
      messages: [],
    });
    const admin = await authFor(app, adminCredentials);
    const headers = {
      Cookie: admin.cookie,
      'X-CSRF-Token': admin.csrf,
      'Content-Type': 'application/json',
    };

    const list = await app.request(`${P}/threads`, { headers });
    const read = await app.request(`${P}/threads/th-foreign`, { headers });
    const post = await app.request(`${P}/threads/th-foreign/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: 'Oi' }),
    });

    expect(((await list.json()) as { id: string }[]).map((t) => t.id)).not.toContain('th-foreign');
    expect(read.status).toBe(404);
    expect(post.status).toBe(404);
    expect((await other.threads.getById('th-foreign'))?.messages).toEqual([]);
  });

  test('cross-condo settings are isolated', async () => {
    const app = await makeApp();
    await createTestCondo(pool, 'condo-other');
    const other = makePostgresRepositories(pool).forCondo('condo-other');
    await other.settings.save({ monthlyFeeCents: 99000, dueDay: 3 });
    const admin = await authFor(app, adminCredentials);
    const headers = {
      Cookie: admin.cookie,
      'X-CSRF-Token': admin.csrf,
      'Content-Type': 'application/json',
    };

    const read = await app.request(`${P}/settings`, { headers });
    const update = await app.request(`${P}/settings`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ monthlyFeeCents: 20000, dueDay: 10 }),
    });

    expect(await read.json()).toEqual({ monthlyFeeCents: 15000, dueDay: 15 });
    expect(update.status).toBe(200);
    expect(await other.settings.get()).toEqual({ monthlyFeeCents: 99000, dueDay: 3 });
    const own = await app.request(`${P}/settings`, { headers });
    expect(await own.json()).toEqual({ monthlyFeeCents: 20000, dueDay: 10 });
  });

  test('cross-condo categories are isolated', async () => {
    const app = await makeApp();
    await createTestCondo(pool, 'condo-other');
    const other = makePostgresRepositories(pool).forCondo('condo-other');
    await other.categories.replaceAll(
      [{ id: 'cat-foreign', name: 'Alheia', keywords: 'alheia', position: 0 }],
      [],
    );
    await other.accounts.save({
      id: 'ac-foreign',
      description: 'Água alheia',
      category: 'Outra',
      date: '2026-07-05',
      valueCents: 5000,
      status: 'pendente',
    });
    const admin = await authFor(app, adminCredentials);
    const headers = {
      Cookie: admin.cookie,
      'X-CSRF-Token': admin.csrf,
      'Content-Type': 'application/json',
    };

    const list = await app.request(`${P}/categories`, { headers });
    const put = await app.request(`${P}/categories`, {
      method: 'PUT',
      headers,
      body: JSON.stringify([{ name: 'Água', keywords: 'água' }]),
    });

    expect(await list.json()).toEqual([]);
    expect(put.status).toBe(200);
    expect(await other.categories.list()).toEqual([
      { id: 'cat-foreign', name: 'Alheia', keywords: 'alheia', position: 0 },
    ]);
    expect((await other.accounts.getById('ac-foreign'))?.category).toBe('Outra');
  });

  test('dashboard summary counts only the current condo', async () => {
    const app = await makeApp();
    await createTestCondo(pool, 'condo-other');
    const other = makePostgresRepositories(pool).forCondo('condo-other');
    const month = new Date().toISOString().slice(0, 7);
    await other.incomes.save({
      id: 'in-foreign',
      description: 'Aluguel salão',
      source: 'Apto 9',
      date: `${month}-05`,
      valueCents: 777700,
    });
    const admin = await authFor(app, adminCredentials);
    const headers = { Cookie: admin.cookie, 'X-CSRF-Token': admin.csrf };

    const res = await app.request(`${P}/dashboard`, { headers });

    const body = (await res.json()) as { balance: { incomeCents: number } };
    expect(body.balance.incomeCents).not.toBe(777700);
    expect(body.balance.incomeCents).toBeLessThan(777700);
  });

  test('cross-condo incomes access answers 404', async () => {
    const app = await makeApp();
    const other = await seedForeignLedger();
    const auth = await authFor(app, adminCredentials);
    const headers = { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrf };

    const list = await app.request(`${P}/incomes`, { headers });
    const proof = await app.request(`${P}/incomes/in-foreign/proof`, { headers });
    const update = await app.request(`${P}/incomes/in-foreign`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueCents: 1 }),
    });
    const archive = await app.request(`${P}/incomes/in-foreign`, { method: 'DELETE', headers });

    expect(((await list.json()) as { id: string }[]).map((i) => i.id)).not.toContain('in-foreign');
    expect(proof.status).toBe(404);
    expect(update.status).toBe(404);
    expect(archive.status).toBe(404);
    expect((await other.incomes.getById('in-foreign'))?.valueCents).toBe(15000);
  });

  test('an admin overrides and then clears a resident status', async () => {
    const app = await makeApp();
    const auth = await authFor(app, adminCredentials);
    const headers = {
      Cookie: auth.cookie,
      'X-CSRF-Token': auth.csrf,
      'Content-Type': 'application/json',
    };

    const override = await app.request(`${P}/residents/${residentCredentials.residentId}/status`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status: 'atrasado' }),
    });
    expect(override.status).toBe(200);

    const clear = await app.request(`${P}/residents/${residentCredentials.residentId}/status`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status: null }),
    });
    expect(clear.status).toBe(200);
  });

  test('overriding a resident status is admin-only', async () => {
    const app = await makeApp();
    const auth = await authFor(app, residentCredentials);
    const res = await app.request(`${P}/residents/${residentCredentials.residentId}/status`, {
      method: 'PUT',
      headers: {
        Cookie: auth.cookie,
        'X-CSRF-Token': auth.csrf,
        'Content-Type': 'application/json',
      },
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

  test('an active resident can still log in', async () => {
    const app = await makeApp();
    const res = await login(app, residentCredentials.username, residentCredentials.password);
    expect(res.status).toBe(200);
  });

  test('an inactive (moved-out) resident cannot log in', async () => {
    const app = await makeApp();
    const admin = await authFor(app, adminCredentials);
    const deactivate = await app.request(`${P}/residents/r-1/deactivate`, {
      method: 'POST',
      headers: { Cookie: admin.cookie, 'X-CSRF-Token': admin.csrf },
    });
    expect(deactivate.ok).toBe(true);

    const res = await login(app, residentCredentials.username, residentCredentials.password);
    expect(res.status).toBe(401);
  });

  test('an active resident can read their own record', async () => {
    const app = await makeApp();
    const auth = await authFor(app, residentCredentials);
    const res = await app.request(`${P}/residents/me`, {
      headers: { Cookie: auth.cookie },
    });
    expect(res.status).toBe(200);
  });

  test("an inactive resident's existing session is rejected on the next request", async () => {
    const app = await makeApp();
    const residentAuth = await authFor(app, residentCredentials); // issued while active
    const admin = await authFor(app, adminCredentials);
    const deactivate = await app.request(`${P}/residents/r-1/deactivate`, {
      method: 'POST',
      headers: { Cookie: admin.cookie, 'X-CSRF-Token': admin.csrf },
    });
    expect(deactivate.ok).toBe(true);

    const res = await app.request(`${P}/residents/me`, {
      headers: { Cookie: residentAuth.cookie },
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Condomínio não encontrado' });
  });

  test('a moved-out resident is refused at login and their open session gets 404', async () => {
    const app = await makeApp();
    const residentAuth = await authFor(app, residentCredentials);
    const admin = await authFor(app, adminCredentials);
    await app.request(`${P}/residents/r-1/deactivate`, {
      method: 'POST',
      headers: { Cookie: admin.cookie, 'X-CSRF-Token': admin.csrf },
    });

    const relogin = await login(app, residentCredentials.username, residentCredentials.password);
    const next = await app.request(`${P}/receipts`, { headers: { Cookie: residentAuth.cookie } });

    expect(relogin.status).toBe(401);
    expect(next.status).toBe(404);
  });

  test("GET /me/condos lists the caller's condos", async () => {
    const app = await makeApp();
    const admin = await authFor(app, adminCredentials);
    const resident = await authFor(app, residentCredentials);

    const adminCondos = await app.request('/me/condos', { headers: { Cookie: admin.cookie } });
    const residentCondos = await app.request('/me/condos', {
      headers: { Cookie: resident.cookie },
    });

    expect(adminCondos.status).toBe(200);
    expect(await adminCondos.json()).toEqual([
      { id: TEST_CONDO_ID, name: `Condomínio ${TEST_CONDO_ID}`, role: 'admin' },
    ]);
    expect(await residentCondos.json()).toEqual([
      { id: TEST_CONDO_ID, name: `Condomínio ${TEST_CONDO_ID}`, role: 'resident' },
    ]);
  });

  test('GET /me/condos requires authentication', async () => {
    const res = await (await makeApp()).request('/me/condos');
    expect(res.status).toBe(401);
  });

  test('a condo the caller has no role in answers 404', async () => {
    const app = await makeApp();
    await createTestCondo(pool, 'condo-other');
    const admin = await authFor(app, adminCredentials);

    const res = await app.request('/api/condos/condo-other/residents', {
      headers: { Cookie: admin.cookie },
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Condomínio não encontrado' });
  });

  test('a token without uid is rejected with 401', async () => {
    const app = await makeApp();
    const now = Math.floor(Date.now() / 1000);
    const legacy = await sign(
      { role: 'admin', sub: 'u-admin', iat: now, exp: now + 60 },
      config.jwtSecret,
      'HS256',
    );

    const res = await app.request(`${P}/residents`, { headers: { Cookie: `session=${legacy}` } });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Sessão inválida' });
  });
});

describe('Morada API — real credentials', () => {
  test('login sets httpOnly session cookie and a readable csrf cookie', async () => {
    const app = await makeApp();
    const res = await login(app, adminCredentials.username, adminCredentials.password);
    expect(res.status).toBe(200);
    const setCookies = res.headers.getSetCookie();
    const session = setCookies.find((c) => c.startsWith('session='));
    const csrf = setCookies.find((c) => c.startsWith('csrf='));
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/SameSite=Strict/i);
    expect(csrf).toBeDefined();
    expect(csrf).not.toMatch(/HttpOnly/i);
  });

  test('login returns the condos the user can enter', async () => {
    const res = await login(await makeApp(), adminCredentials.username, adminCredentials.password);
    expect(res.status).toBe(200);
    const body: unknown = await res.json();
    expect(body).not.toHaveProperty('token');
    expect(body).toEqual({
      condos: [{ id: TEST_CONDO_ID, name: `Condomínio ${TEST_CONDO_ID}`, role: 'admin' }],
      emailVerified: true,
    });
  });

  test('login returns emailVerified true for a legacy username user', async () => {
    const res = await login(await makeApp(), adminCredentials.username, adminCredentials.password);
    expect(await res.json()).toMatchObject({ emailVerified: true });
  });

  test('login by email ignores case and surrounding spaces', async () => {
    const app = await makeApp();
    await insertEmailUser('ana@x.com', 'senha-segura-1');
    const res = await loginWith(app, { login: ' ANA@x.com ', password: 'senha-segura-1' });
    expect(res.status).toBe(200);
  });

  test('an e-mail account with zero condos logs in', async () => {
    const app = await makeApp();
    await insertEmailUser('ana@x.com', 'senha-segura-1');
    const res = await loginWith(app, { login: 'ana@x.com', password: 'senha-segura-1' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ condos: [], emailVerified: false });
  });

  test('a legacy username user with zero condos is refused with 401', async () => {
    const app = await makeApp();
    await insertUser({ username: 'solto101', email: null, password: 'senha-segura-1' });
    const res = await loginWith(app, { login: 'solto101', password: 'senha-segura-1' });
    expect(res.status).toBe(401);
  });

  test('login accepts both login and the username alias but not neither', async () => {
    const app = await makeApp();
    const neither = await loginWith(app, { password: adminCredentials.password });
    expect(neither.status).toBe(400);
  });

  test('GET /me returns the account state', async () => {
    const app = await makeApp();
    await insertEmailUser('ana@x.com', 'senha-segura-1');
    const res = await loginWith(app, { login: 'ana@x.com', password: 'senha-segura-1' });
    const cookies = res.headers.getSetCookie();
    const cookie = `session=${parseCookie(cookies, 'session')}; csrf=${parseCookie(cookies, 'csrf')}`;
    const me = await app.request('/me', { headers: { Cookie: cookie } });
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({
      id: 'u-ana',
      name: 'Ana',
      email: 'ana@x.com',
      emailVerified: false,
      condos: [],
    });
  });

  test('GET /me requires a session', async () => {
    const res = await (await makeApp()).request('/me');
    expect(res.status).toBe(401);
  });

  test('a wrong password is rejected with 401', async () => {
    const res = await login(await makeApp(), adminCredentials.username, 'senha-errada');
    expect(res.status).toBe(401);
  });

  test('an unknown username is rejected with 401', async () => {
    const res = await login(await makeApp(), 'ninguem', adminCredentials.password);
    expect(res.status).toBe(401);
  });

  test('repeated bad logins are rate-limited after 5 attempts', async () => {
    const app = await makeApp();

    for (let i = 0; i < 5; i++) {
      const res = await login(app, adminCredentials.username, 'senha-errada');
      expect(res.status).toBe(401);
    }

    const sixth = await login(app, adminCredentials.username, 'senha-errada');
    expect(sixth.status).toBe(429);
  });

  test('a good login still succeeds when under the rate limit', async () => {
    const app = await makeApp();

    for (let i = 0; i < 4; i++) {
      const res = await login(app, adminCredentials.username, 'senha-errada');
      expect(res.status).toBe(401);
    }

    const res = await login(app, adminCredentials.username, adminCredentials.password);
    expect(res.status).toBe(200);
  });

  test('a resident reads their own record via GET /api/residents/me', async () => {
    const app = await makeApp();
    const auth = await authFor(app, residentCredentials);
    const res = await app.request(`${P}/residents/me`, {
      headers: { Cookie: auth.cookie },
    });
    expect(res.status).toBe(200);
    const me = (await res.json()) as { id: string; name: string };
    expect(me.id).toBe(residentCredentials.residentId);
    expect(me.name).toBe('Maria Ribeiro');
  });

  test('GET /api/residents/me still requires authentication', async () => {
    const res = await (await makeApp()).request(`${P}/residents/me`);
    expect(res.status).toBe(401);
  });

  test("a resident token is scoped to that resident's own id", async () => {
    const app = await makeApp();
    const resAuth = await authFor(app, residentCredentials);
    const auth = (path: string) => app.request(path, { headers: { Cookie: resAuth.cookie } });

    const own = await auth(`${P}/threads/${residentCredentials.residentId}`);
    expect(own.status).toBe(200);

    const foreign = await auth(`${P}/threads/t-2`);
    expect(foreign.status).toBe(403);
  });

  test('logout clears the session cookie so the next request is unauthenticated', async () => {
    const app = await makeApp();
    const auth = await authFor(app, adminCredentials);
    const out = await app.request('/auth/logout', {
      method: 'POST',
      headers: { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrf },
    });
    expect(out.status).toBe(204);
    const cleared = out.headers.getSetCookie().find((c) => c.startsWith('session='));
    expect(cleared).toMatch(/Max-Age=0/i);
  });

  test('logout without a CSRF token is rejected', async () => {
    const app = await makeApp();
    const auth = await authFor(app, adminCredentials);
    const out = await app.request('/auth/logout', {
      method: 'POST',
      headers: { Cookie: auth.cookie },
    });
    expect(out.status).toBe(403);
  });
});

async function adminAuthFor(app: App) {
  const auth = await authFor(app, adminCredentials);
  return (path: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Cookie: auth.cookie,
        'X-CSRF-Token': auth.csrf,
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
      (await auth(`${P}/residents`, { method: 'POST', body: resident('Apto 999', 'A') })).status,
    ).toBe(201);
    const second = await auth(`${P}/residents`, {
      method: 'POST',
      body: resident('Apto 999', 'B'),
    });
    expect(second.status).toBe(409);
  });

  test('a resident can be moved out, freeing the apartment for the next', async () => {
    const app = await makeApp();
    const auth = await adminAuthFor(app);
    const first = await auth(`${P}/residents`, { method: 'POST', body: resident('Apto 888', 'A') });
    const { id } = (await first.json()) as { id: string };

    expect((await auth(`${P}/residents/${id}/deactivate`, { method: 'POST' })).status).toBe(204);
    // now the apartment is free again
    const next = await auth(`${P}/residents`, { method: 'POST', body: resident('Apto 888', 'B') });
    expect(next.status).toBe(201);
    // the active-residents list shows the new occupant, not the old one
    const listed = (await (await auth(`${P}/residents`)).json()) as { name: string; apt: string }[];
    const at888 = listed.filter((r) => r.apt === 'Apto 888');
    expect(at888.map((r) => r.name)).toEqual(['B']);
  });

  test("an admin reads an apartment's occupant history (current + former, active-first)", async () => {
    const app = await makeApp();
    const auth = await adminAuthFor(app);
    const first = await auth(`${P}/residents`, { method: 'POST', body: resident('Apto 777', 'A') });
    const { id, apartmentId } = (await first.json()) as { id: string; apartmentId: string };
    expect((await auth(`${P}/residents/${id}/deactivate`, { method: 'POST' })).status).toBe(204);
    await auth(`${P}/residents`, { method: 'POST', body: resident('Apto 777', 'B') });

    const res = await auth(`${P}/apartments/${apartmentId}/residents`);
    expect(res.status).toBe(200);
    const history = (await res.json()) as { name: string; active: boolean }[];
    expect(history.map((r) => r.name).sort()).toEqual(['A', 'B']);
    expect(history[0]?.name).toBe('B'); // active occupant first
    expect(history[0]?.active).toBe(true);
  });

  test('the apartment occupant history is admin-only', async () => {
    const app = await makeApp();
    const auth = await authFor(app, residentCredentials);
    const res = await app.request(`${P}/apartments/apt-r-1/residents`, {
      headers: { Cookie: auth.cookie },
    });
    expect(res.status).toBe(403);
  });

  test("an admin reads an apartment's full receipt ledger", async () => {
    const app = await makeApp();
    const auth = await adminAuthFor(app);
    // fixtures seed r-1 (Apto 302) with receipts under apartment apt-r-1
    const res = await auth(`${P}/apartments/apt-r-1/receipts`);
    expect(res.status).toBe(200);
    const receipts = (await res.json()) as { residentId: string }[];
    expect(receipts.length).toBeGreaterThan(0);
    expect(receipts.every((r) => r.residentId === 'r-1')).toBe(true);
  });

  test('the apartment ledger is admin-only', async () => {
    const app = await makeApp();
    const auth = await authFor(app, residentCredentials);
    const res = await app.request(`${P}/apartments/apt-r-1/receipts`, {
      headers: { Cookie: auth.cookie },
    });
    expect(res.status).toBe(403);
  });
});

describe('Morada API — admin provisions resident logins', () => {
  const adminAuth = adminAuthFor;

  test('an admin creates a login and the new resident can log in with the temp password', async () => {
    const app = await makeApp();
    const auth = await adminAuth(app);

    const created = await auth(`${P}/users`, {
      method: 'POST',
      body: JSON.stringify({ residentId: 'r-3' }),
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as { username: string; tempPassword: string };
    expect(body.username).toBe('ana202');
    expect(body.tempPassword).toMatch(/.{8,}/);

    const loginRes = await login(app, 'ana202', body.tempPassword);
    expect(loginRes.status).toBe(200);
    expect(await loginRes.json()).toEqual({
      condos: [{ id: TEST_CONDO_ID, name: `Condomínio ${TEST_CONDO_ID}`, role: 'resident' }],
      emailVerified: true,
    });
  });

  test("cannot provision a login for another condo's resident", async () => {
    const app = await makeApp();
    await createTestCondo(pool, 'condo-other');
    await makePostgresRepositories(pool).forCondo('condo-other').residents.save({
      id: 'r-foreign',
      name: 'Forasteiro',
      apt: 'Apto 900',
      phone: '',
      email: '',
      status: 'em_dia',
    });
    const auth = await adminAuth(app);

    const res = await auth(`${P}/users`, {
      method: 'POST',
      body: JSON.stringify({ residentId: 'r-foreign' }),
    });

    expect(res.status).toBe(404);
    expect(await count("users WHERE resident_id = 'r-foreign'")).toBe(0);
    expect(await count("condo_roles WHERE resident_id = 'r-foreign'")).toBe(0);
  });

  test('provisioning a resident login is admin-only', async () => {
    const app = await makeApp();
    const auth = await authFor(app, residentCredentials);
    const res = await app.request(`${P}/users`, {
      method: 'POST',
      headers: {
        Cookie: auth.cookie,
        'X-CSRF-Token': auth.csrf,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ residentId: 'r-4' }),
    });
    expect(res.status).toBe(403);
  });

  test('provisioning for a nonexistent resident is rejected with 404', async () => {
    const app = await makeApp();
    const auth = await adminAuth(app);
    const res = await auth(`${P}/users`, {
      method: 'POST',
      body: JSON.stringify({ residentId: 'r-does-not-exist' }),
    });
    expect(res.status).toBe(404);
  });

  test('provisioning a login for a resident that already has one is rejected with 409', async () => {
    const app = await makeApp();
    const auth = await adminAuth(app);
    const res = await auth(`${P}/users`, {
      method: 'POST',
      body: JSON.stringify({ residentId: residentCredentials.residentId }),
    });
    expect(res.status).toBe(409);
  });
});

describe('Morada API — admin reads and resets resident logins', () => {
  test('an admin reads the username of a resident that has a login', async () => {
    const app = await makeApp();
    const auth = await adminAuthFor(app);
    const res = await auth(`${P}/residents/${residentCredentials.residentId}/login`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      username: residentCredentials.username,
      suggested: residentCredentials.username,
    });
  });

  test('reading the login of a resident without one returns the derived suggestion', async () => {
    const app = await makeApp();
    const auth = await adminAuthFor(app);
    const res = await auth(`${P}/residents/r-3/login`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ username: null, suggested: 'ana202' });
  });

  test('reading the login of a nonexistent resident answers 404', async () => {
    const app = await makeApp();
    const auth = await adminAuthFor(app);
    const res = await auth(`${P}/residents/r-does-not-exist/login`);
    expect(res.status).toBe(404);
  });

  test("cannot read or reset the login of another condo's resident", async () => {
    const app = await makeApp();
    await createTestCondo(pool, 'condo-other');
    const repos = makePostgresRepositories(pool);
    await repos.forCondo('condo-other').residents.save({
      id: 'r-foreign',
      name: 'Forasteiro',
      apt: 'Apto 900',
      phone: '',
      email: '',
      status: 'em_dia',
    });
    await repos.users.save({
      id: 'u-foreign',
      username: 'forasteiro900',
      passwordHash: 'hash-foreign',
      role: 'resident',
      residentId: 'r-foreign',
      email: null,
      name: null,
      emailVerifiedAt: null,
      sessionVersion: 0,
    });
    const auth = await adminAuthFor(app);

    const read = await auth(`${P}/residents/r-foreign/login`);
    const reset = await auth(`${P}/residents/r-foreign/login/reset`, { method: 'POST' });

    expect(read.status).toBe(404);
    expect(reset.status).toBe(404);
    expect((await repos.users.findByUsername('forasteiro900'))?.passwordHash).toBe('hash-foreign');
  });

  test('reading a resident login is admin-only', async () => {
    const app = await makeApp();
    const auth = await authFor(app, residentCredentials);
    const res = await app.request(`${P}/residents/${residentCredentials.residentId}/login`, {
      headers: { Cookie: auth.cookie },
    });
    expect(res.status).toBe(403);
  });

  test('an admin resets a resident password and the resident logs in with the new one', async () => {
    const app = await makeApp();
    const auth = await adminAuthFor(app);
    const reset = await auth(`${P}/residents/${residentCredentials.residentId}/login/reset`, {
      method: 'POST',
    });
    expect(reset.status).toBe(200);
    const body = (await reset.json()) as { username: string; tempPassword: string };
    expect(body.username).toBe(residentCredentials.username);
    expect(body.tempPassword).toMatch(/.{8,}/);
    expect(body.tempPassword).not.toBe(residentCredentials.password);

    const loginRes = await login(app, residentCredentials.username, body.tempPassword);
    expect(loginRes.status).toBe(200);
    expect(await loginRes.json()).toEqual({
      condos: [{ id: TEST_CONDO_ID, name: `Condomínio ${TEST_CONDO_ID}`, role: 'resident' }],
      emailVerified: true,
    });
  });

  test('resetting the password of a resident without a login returns 404', async () => {
    const app = await makeApp();
    const auth = await adminAuthFor(app);
    const res = await auth(`${P}/residents/r-3/login/reset`, { method: 'POST' });
    expect(res.status).toBe(404);
  });
});

describe('Morada API — authorization wiring', () => {
  async function withCreds(creds: { username: string; password: string }) {
    const app = await makeApp();
    const userAuth = await authFor(app, creds);
    const auth = (path: string, init: RequestInit = {}) =>
      app.request(path, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          Cookie: userAuth.cookie,
          'X-CSRF-Token': userAuth.csrf,
        },
      });
    return { app, auth };
  }

  test('accounts are admin-only', async () => {
    const resident = await withCreds(residentCredentials);
    expect((await resident.auth(`${P}/accounts`)).status).toBe(403);
    const admin = await withCreds(adminCredentials);
    expect((await admin.auth(`${P}/accounts`)).status).toBe(200);
  });

  test('incomes are admin-only; an admin can create one', async () => {
    const resident = await withCreds(residentCredentials);
    expect((await resident.auth(`${P}/incomes`)).status).toBe(403);

    const admin = await withCreds(adminCredentials);
    const res = await admin.auth(`${P}/incomes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Aluguel salão de festas',
        source: 'Salão de festas',
        date: '2026-05-10',
        valueCents: 20000,
      }),
    });
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: string; description: string };
    expect(created.description).toBe('Aluguel salão de festas');
  });

  test('updating and deleting an income is admin-only', async () => {
    const resident = await withCreds(residentCredentials);
    const put = await resident.auth(`${P}/incomes/whatever`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(put.status).toBe(403);
    expect((await resident.auth(`${P}/incomes/whatever`, { method: 'DELETE' })).status).toBe(403);
  });

  test('updating a non-existent income returns 404 instead of creating it', async () => {
    const admin = await withCreds(adminCredentials);
    const res = await admin.auth(`${P}/incomes/ghost-id`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Fantasma',
        source: 'Nada',
        date: '2026-05-10',
        valueCents: 100,
      }),
    });
    expect(res.status).toBe(404);
    expect((await admin.auth(`${P}/incomes`)).status).toBe(200);
    expect(await (await admin.auth(`${P}/incomes`)).json()).toEqual([]);
  });

  test('rejects an income with an impossible date as 400', async () => {
    const admin = await withCreds(adminCredentials);
    const res = await admin.auth(`${P}/incomes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Data ruim',
        source: 'Teste',
        date: '2026-13-45',
        valueCents: 100,
      }),
    });
    expect(res.status).toBe(400);
  });

  test('settings are admin-only', async () => {
    const resident = await withCreds(residentCredentials);
    expect((await resident.auth(`${P}/settings`)).status).toBe(403);
    const admin = await withCreds(adminCredentials);
    const res = await admin.auth(`${P}/settings`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ monthlyFeeCents: 15000, dueDay: 15 });
  });

  test('categories are admin-only; saving reclassifies matching accounts', async () => {
    const resident = await withCreds(residentCredentials);
    expect((await resident.auth(`${P}/categories`)).status).toBe(403);

    const admin = await withCreds(adminCredentials);
    const list = await admin.auth(`${P}/categories`);
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual([]);

    // fixtures seed account a-1 with description "Água — abril" — matched by keyword "água"
    const put = await admin.auth(`${P}/categories`, {
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

    const accounts = await admin.auth(`${P}/accounts`);
    const list2 = (await accounts.json()) as { id: string; category: string }[];
    expect(list2.find((a) => a.id === 'a-1')?.category).toBe('Água');
  });

  test('receipts and dashboard are open to any authenticated user', async () => {
    const { auth } = await withCreds(residentCredentials);
    expect((await auth(`${P}/receipts`)).status).toBe(200);
    expect((await auth(`${P}/dashboard`)).status).toBe(200);
  });

  test('a resident lists only their own receipts', async () => {
    const { auth } = await withCreds(residentCredentials); // r-1
    const res = await auth(`${P}/receipts`);
    const receipts = (await res.json()) as { id: string; residentId?: string }[];
    expect(receipts.length).toBeGreaterThan(0);
    expect(receipts.every((r) => r.residentId === 'r-1')).toBe(true);
    expect(receipts.some((r) => r.id === 'rc-5')).toBe(false); // rc-5 belongs to r-3
  });

  test('a resident cannot read or pay another resident receipt (403)', async () => {
    const { auth } = await withCreds(residentCredentials); // r-1
    expect((await auth(`${P}/receipts/rc-5`)).status).toBe(403); // rc-5 is r-3's
    const pay = await auth(`${P}/receipts/rc-5/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'pix' }),
    });
    expect(pay.status).toBe(403);
  });

  test('a resident cannot pay their own receipt directly (admin-only)', async () => {
    const { auth } = await withCreds(residentCredentials); // r-1 owns rc-1
    const pay = await auth(`${P}/receipts/rc-1/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'pix' }),
    });
    expect(pay.status).toBe(403);
  });

  test('a resident submits a payment with proof for their own receipt, moving it to em_analise', async () => {
    const { auth } = await withCreds(residentCredentials); // r-1 owns rc-1
    const submit = await auth(`${P}/receipts/rc-1/submit-payment`, {
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
    const admin = await authFor(app, adminCredentials);
    const issue = await app.request(`${P}/receipts`, {
      method: 'POST',
      headers: {
        Cookie: admin.cookie,
        'X-CSRF-Token': admin.csrf,
        'Content-Type': 'application/json',
      },
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

    const resident = await authFor(app, residentCredentials);
    const mine = await app.request(`${P}/receipts`, {
      headers: { Cookie: resident.cookie },
    });
    const ids = ((await mine.json()) as { id: string }[]).map((r) => r.id);
    expect(ids).toContain(created.id);
  });

  test('issuing a duplicate condo-fee charge for the same resident/month is rejected with 409', async () => {
    const app = await makeApp();
    const admin = await authFor(app, adminCredentials);
    const issue = () =>
      app.request(`${P}/receipts`, {
        method: 'POST',
        headers: {
          Cookie: admin.cookie,
          'X-CSRF-Token': admin.csrf,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          residentId: 'r-1',
          ref: '05/2026',
          title: 'Taxa condominial',
          valueCents: 45000,
          dueDate: '2026-05-10',
        }),
      });
    expect((await issue()).status).toBe(201);

    const second = await issue();
    expect(second.status).toBe(409);
    const body = (await second.json()) as { error: string };
    expect(body.error).toMatch(/já existe/);
  });

  test('issuing a charge is admin-only', async () => {
    const app = await makeApp();
    const auth = await authFor(app, residentCredentials);
    const res = await app.request(`${P}/receipts`, {
      method: 'POST',
      headers: {
        Cookie: auth.cookie,
        'X-CSRF-Token': auth.csrf,
        'Content-Type': 'application/json',
      },
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
    const auth = await authFor(app, adminCredentials);
    const res = await app.request(`${P}/receipts`, {
      method: 'POST',
      headers: {
        Cookie: auth.cookie,
        'X-CSRF-Token': auth.csrf,
        'Content-Type': 'application/json',
      },
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

  test('deleting a receipt is admin-only', async () => {
    const resident = await withCreds(residentCredentials);
    expect((await resident.auth(`${P}/receipts/rc-2`, { method: 'DELETE' })).status).toBe(403);
  });

  test('an admin deletes a receipt (204), it disappears from the apartment ledger, and a repeat 404s', async () => {
    const admin = await withCreds(adminCredentials);
    const del = await admin.auth(`${P}/receipts/rc-2`, { method: 'DELETE' });
    expect(del.status).toBe(204);

    const ledger = await admin.auth(`${P}/apartments/apt-r-1/receipts`);
    const ids = ((await ledger.json()) as { id: string }[]).map((r) => r.id);
    expect(ids).not.toContain('rc-2');

    expect((await admin.auth(`${P}/receipts/rc-2`, { method: 'DELETE' })).status).toBe(404);
  });

  test('deleting a paid receipt removes its value from the dashboard balance', async () => {
    const admin = await withCreds(adminCredentials);
    const before = (await (await admin.auth(`${P}/dashboard`)).json()) as {
      balance: { balanceCents: number };
    };

    await admin.auth(`${P}/receipts/rc-2`, { method: 'DELETE' });

    const after = (await (await admin.auth(`${P}/dashboard`)).json()) as {
      balance: { balanceCents: number };
    };
    expect(after.balance.balanceCents).toBe(before.balance.balanceCents - 45000);
  });

  test('deleting an account is admin-only', async () => {
    const resident = await withCreds(residentCredentials);
    expect((await resident.auth(`${P}/accounts/a-1`, { method: 'DELETE' })).status).toBe(403);
  });

  test('an admin deletes an account (204), it disappears from the list, and a repeat 404s', async () => {
    const admin = await withCreds(adminCredentials);
    const del = await admin.auth(`${P}/accounts/a-1`, { method: 'DELETE' });
    expect(del.status).toBe(204);

    const list = await admin.auth(`${P}/accounts`);
    const ids = ((await list.json()) as { id: string }[]).map((a) => a.id);
    expect(ids).not.toContain('a-1');

    expect((await admin.auth(`${P}/accounts/a-1`, { method: 'DELETE' })).status).toBe(404);
  });

  test('deleting an account no longer counts it in the dashboard summary', async () => {
    const admin = await withCreds(adminCredentials);
    const before = (await (await admin.auth(`${P}/dashboard`)).json()) as {
      recentPaid: { id: string }[];
    };
    expect(before.recentPaid.some((item) => item.id === 'a-1')).toBe(true);

    await admin.auth(`${P}/accounts/a-1`, { method: 'DELETE' });

    const after = (await (await admin.auth(`${P}/dashboard`)).json()) as {
      recentPaid: { id: string }[];
    };
    expect(after.recentPaid.some((item) => item.id === 'a-1')).toBe(false);
  });

  test('notices are readable by residents but writable only by admins', async () => {
    const resident = await withCreds(residentCredentials);
    expect((await resident.auth(`${P}/notices`)).status).toBe(200);
    const write = (a: typeof resident.auth) =>
      a(`${P}/notices`, {
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
    expect((await auth(`${P}/notices/n-1/dismiss`, { method: 'POST' })).status).toBe(200);
    expect((await auth(`${P}/notices/n-1`, { method: 'DELETE' })).status).toBe(403);
  });

  test('listing all threads is admin-only, but a resident can read their own thread', async () => {
    const resident = await withCreds(residentCredentials);
    expect((await resident.auth(`${P}/threads`)).status).toBe(403);
    expect((await resident.auth(`${P}/threads/${residentCredentials.residentId}`)).status).toBe(
      200,
    );
    const admin = await withCreds(adminCredentials);
    expect((await admin.auth(`${P}/threads`)).status).toBe(200);
  });

  test('a resident cannot read or write another resident thread (IDOR blocked)', async () => {
    const { auth } = await withCreds(residentCredentials);
    expect((await auth(`${P}/threads/t-2`)).status).toBe(403);
    const post = await auth(`${P}/threads/t-2/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'intruso' }),
    });
    expect(post.status).toBe(403);
  });

  test('message author is derived from the token role, not the request body', async () => {
    const { auth } = await withCreds(residentCredentials);
    const res = await auth(`${P}/threads/${residentCredentials.residentId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: 'admin', text: 'tentativa de spoof' }),
    });
    expect(res.status).toBe(200);
    const thread = (await res.json()) as { messages: { author: string; text: string }[] };
    const last = thread.messages[thread.messages.length - 1];
    expect(last?.author).toBe('resident');
  });

  test('a receipt proof is servable by its owning resident and by an admin', async () => {
    const app = await makeApp();
    const residentAuth = await authFor(app, residentCredentials); // r-1 owns rc-1
    const submit = await app.request(`${P}/receipts/rc-1/submit-payment`, {
      method: 'POST',
      headers: {
        Cookie: residentAuth.cookie,
        'X-CSRF-Token': residentAuth.csrf,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'pix',
        proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      }),
    });
    expect(submit.status).toBe(200);

    const ownerRes = await app.request(`${P}/receipts/rc-1/proof`, {
      headers: { Cookie: residentAuth.cookie },
    });
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.headers.get('Content-Type')).toBe('image/png');
    expect(new Uint8Array(await ownerRes.arrayBuffer()).length).toBeGreaterThan(0);

    const adminAuth = await authFor(app, adminCredentials);
    const adminRes = await app.request(`${P}/receipts/rc-1/proof`, {
      headers: { Cookie: adminAuth.cookie },
    });
    expect(adminRes.status).toBe(200);
    expect(adminRes.headers.get('Content-Type')).toBe('image/png');
  });

  test('a resident cannot read another resident receipt proof (403)', async () => {
    const { auth } = await withCreds(residentCredentials); // r-1, rc-5 belongs to r-3
    const res = await auth(`${P}/receipts/rc-5/proof`);
    expect(res.status).toBe(403);
  });

  test('a receipt without a proof returns 404', async () => {
    const { auth } = await withCreds(residentCredentials); // r-1 owns rc-1, no proof yet
    const res = await auth(`${P}/receipts/rc-1/proof`);
    expect(res.status).toBe(404);
  });

  test('a missing receipt proof route returns 404', async () => {
    const { auth } = await withCreds(adminCredentials);
    const res = await auth(`${P}/receipts/ghost-id/proof`);
    expect(res.status).toBe(404);
  });

  test('an income proof is servable by an admin, admin-only, and 404 without one', async () => {
    const admin = await withCreds(adminCredentials);
    const created = await admin.auth(`${P}/incomes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Aluguel salão de festas',
        source: 'Salão de festas',
        date: '2026-05-10',
        valueCents: 20000,
        proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      }),
    });
    expect(created.status).toBe(201);
    const income = (await created.json()) as { id: string };

    const proofRes = await admin.auth(`${P}/incomes/${income.id}/proof`);
    expect(proofRes.status).toBe(200);
    expect(proofRes.headers.get('Content-Type')).toBe('image/png');

    const resident = await withCreds(residentCredentials);
    expect((await resident.auth(`${P}/incomes/${income.id}/proof`)).status).toBe(403);

    const withoutProof = await admin.auth(`${P}/incomes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Sem comprovante',
        source: 'Teste',
        date: '2026-05-11',
        valueCents: 5000,
      }),
    });
    const incomeNoProof = (await withoutProof.json()) as { id: string };
    expect((await admin.auth(`${P}/incomes/${incomeNoProof.id}/proof`)).status).toBe(404);
  });

  test('an account proof is downloadable by admin and by a resident; 404 without one', async () => {
    const app = await makeApp();
    const adminAuth = await authFor(app, adminCredentials);
    const put = await app.request(`${P}/accounts/a-proof`, {
      method: 'PUT',
      headers: {
        Cookie: adminAuth.cookie,
        'X-CSRF-Token': adminAuth.csrf,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: 'Energia — áreas comuns',
        category: 'Utilidades',
        date: '2026-05-10',
        valueCents: 8900,
        status: 'pago',
        proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      }),
    });
    expect(put.status).toBe(200);

    const adminProof = await app.request(`${P}/accounts/a-proof/proof`, {
      headers: { Cookie: adminAuth.cookie },
    });
    expect(adminProof.status).toBe(200);
    expect(adminProof.headers.get('Content-Type')).toBe('image/png');

    const residentAuth = await authFor(app, residentCredentials);
    const residentProof = await app.request(`${P}/accounts/a-proof/proof`, {
      headers: { Cookie: residentAuth.cookie },
    });
    expect(residentProof.status).toBe(200);
    expect(residentProof.headers.get('Content-Type')).toBe('image/png');

    const noProof = await app.request(`${P}/accounts/a-plain`, {
      method: 'PUT',
      headers: {
        Cookie: adminAuth.cookie,
        'X-CSRF-Token': adminAuth.csrf,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: 'Sem comprovante',
        category: 'Utilidades',
        date: '2026-05-11',
        valueCents: 5000,
        status: 'pago',
      }),
    });
    expect(noProof.status).toBe(200);
    expect(
      (await app.request(`${P}/accounts/a-plain/proof`, { headers: { Cookie: adminAuth.cookie } }))
        .status,
    ).toBe(404);
    expect(
      (await app.request(`${P}/accounts/ghost/proof`, { headers: { Cookie: adminAuth.cookie } }))
        .status,
    ).toBe(404);
  });
});

describe('Morada API — sign-up and e-mail confirmation', () => {
  const signupBody = { name: 'Ana', email: 'ana@x.com', password: 'senha-segura-1' };

  function postJson(app: App, path: string, body: unknown, headers: Record<string, string> = {}) {
    return app.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  }

  function signup(app: App, body: unknown = signupBody, ip = '1.1.1.1') {
    return postJson(app, '/auth/signup', body, { 'X-Forwarded-For': ip });
  }

  function confirmTokenIn(sender: InMemoryEmailSender, to: string): string {
    return /confirmar-email\/([\w-]+)/.exec(sender.lastTo(to)?.text ?? '')?.[1] ?? '';
  }

  test('sign-up answers 202, creates an unconfirmed user and e-mails a confirmation link', async () => {
    const sender = new InMemoryEmailSender();
    const app = await makeApp({ email: sender });

    const res = await signup(app);

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({});
    const { rows } = await pool.query(
      'SELECT name, role, username, email_verified_at FROM users WHERE email = $1',
      ['ana@x.com'],
    );
    expect(rows).toEqual([{ name: 'Ana', role: 'admin', username: null, email_verified_at: null }]);
    expect(sender.lastTo('ana@x.com')?.subject).toBe('Confirme seu e-mail no Morada');
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  test('sign-up with a verified e-mail answers 202, creates nothing and warns the owner', async () => {
    const sender = new InMemoryEmailSender();
    const app = await makeApp({ email: sender });
    await signup(app);
    await postJson(app, '/auth/email/confirm', { token: confirmTokenIn(sender, 'ana@x.com') });

    const res = await signup(app, { ...signupBody, name: 'Intruso' });

    expect(res.status).toBe(202);
    expect(await count("users WHERE email = 'ana@x.com'")).toBe(1);
    expect(sender.sent).toHaveLength(2);
    expect(await count("users WHERE email = 'ana@x.com' AND name = 'Ana'")).toBe(1);
    expect(sender.lastTo('ana@x.com')?.subject).not.toBe('Confirme seu e-mail no Morada');
    expect(sender.lastTo('ana@x.com')?.text).toContain('/#/redefinir-senha/');
  });

  test('sign-up rejects invalid data with 400', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });

    expect((await signup(app, { ...signupBody, password: 'curta' })).status).toBe(400);
  });

  test('the 11th sign-up from one IP is rate limited', async () => {
    const sender = new InMemoryEmailSender();
    const app = await makeApp({ email: sender });

    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      statuses.push((await signup(app, { ...signupBody, email: `u${i}@x.com` })).status);
    }

    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(202));
    expect(statuses[10]).toBe(429);
    expect((await signup(app, signupBody, '2.2.2.2')).status).toBe(202);
  });

  test('confirming sets emailVerifiedAt, logs in, and a second use of the token is 404', async () => {
    const sender = new InMemoryEmailSender();
    const app = await makeApp({ email: sender });
    await signup(app);
    const token = confirmTokenIn(sender, 'ana@x.com');

    const res = await postJson(app, '/auth/email/confirm', { token });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ condos: [], emailVerified: true });
    expect(res.headers.getSetCookie().some((c) => c.startsWith('session='))).toBe(true);
    const { rows } = await pool.query('SELECT email_verified_at FROM users WHERE email = $1', [
      'ana@x.com',
    ]);
    expect(rows[0]?.email_verified_at).toBeInstanceOf(Date);

    const again = await postJson(app, '/auth/email/confirm', { token });
    expect(again.status).toBe(404);
    expect(await again.json()).toEqual({ error: 'Link inválido ou expirado' });
  });

  test('an unknown or malformed token is 404', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });

    expect((await postJson(app, '/auth/email/confirm', { token: 'nope' })).status).toBe(404);
    expect((await postJson(app, '/auth/email/confirm', {})).status).toBe(404);
  });

  test('an expired token is 404', async () => {
    const sender = new InMemoryEmailSender();
    const issuedAt = new Date('2026-01-01T00:00:00.000Z');
    const app = await makeApp({ email: sender, now: () => issuedAt });
    await signup(app);
    const token = confirmTokenIn(sender, 'ana@x.com');
    const lateApp = await buildApp(makePostgresRepositories(pool), {
      email: sender,
      now: () => new Date('2026-01-03T00:00:00.000Z'),
    });

    expect((await postJson(lateApp, '/auth/email/confirm', { token })).status).toBe(404);
  });

  test('resend needs a session and CSRF, sends a new link and revokes the previous one', async () => {
    const sender = new InMemoryEmailSender();
    const app = await makeApp({ email: sender });
    await signup(app);
    const first = confirmTokenIn(sender, 'ana@x.com');

    expect((await postJson(app, '/auth/email/resend', {})).status).toBe(401);

    const unconfirmed = await loginWith(app, { login: 'ana@x.com', password: 'senha-segura-1' });
    const cookies = unconfirmed.headers.getSetCookie();
    const csrf = parseCookie(cookies, 'csrf');
    const cookie = `session=${parseCookie(cookies, 'session')}; csrf=${csrf}`;

    expect((await postJson(app, '/auth/email/resend', {}, { Cookie: cookie })).status).toBe(403);
    const res = await postJson(
      app,
      '/auth/email/resend',
      {},
      { Cookie: cookie, 'X-CSRF-Token': csrf },
    );
    expect(res.status).toBe(204);
    const second = confirmTokenIn(sender, 'ana@x.com');
    expect(second).not.toBe(first);

    expect((await postJson(app, '/auth/email/confirm', { token: first })).status).toBe(404);
    const confirmed = await postJson(app, '/auth/email/confirm', { token: second });
    expect(confirmed.status).toBe(200);
    expect(
      (await postJson(app, '/auth/email/resend', {}, { Cookie: cookie, 'X-CSRF-Token': csrf }))
        .status,
    ).toBe(401);

    const fresh = confirmed.headers.getSetCookie();
    const freshCsrf = parseCookie(fresh, 'csrf');
    const freshCookie = `session=${parseCookie(fresh, 'session')}; csrf=${freshCsrf}`;
    const sentBefore = sender.sent.length;
    const noop = await postJson(
      app,
      '/auth/email/resend',
      {},
      { Cookie: freshCookie, 'X-CSRF-Token': freshCsrf },
    );
    expect(noop.status).toBe(204);
    expect(sender.sent).toHaveLength(sentBefore);
  });
});

describe('Morada API — forgot and reset password', () => {
  function postJson(app: App, path: string, body: unknown, headers: Record<string, string> = {}) {
    return app.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  }

  function forgot(app: App, email: string, ip = '1.1.1.1') {
    return postJson(app, '/auth/password/forgot', { email }, { 'X-Forwarded-For': ip });
  }

  function resetTokenIn(sender: InMemoryEmailSender, to: string): string {
    return /redefinir-senha\/([\w-]+)/.exec(sender.lastTo(to)?.text ?? '')?.[1] ?? '';
  }

  function sessionCookieOf(res: Response): string {
    return `session=${parseCookie(res.headers.getSetCookie(), 'session')}`;
  }

  test('an unknown e-mail answers 204 and sends nothing', async () => {
    const sender = new InMemoryEmailSender();
    const app = await makeApp({ email: sender });

    const res = await forgot(app, 'ghost@x.com');

    expect(res.status).toBe(204);
    expect(sender.sent).toEqual([]);
  });

  test('a known e-mail answers 204 and receives a reset link', async () => {
    const sender = new InMemoryEmailSender();
    const app = await makeApp({ email: sender });
    await insertEmailUser('ana@x.com', 'senha-antiga-1');

    const res = await forgot(app, 'ANA@x.com');

    expect(res.status).toBe(204);
    expect(sender.lastTo('ana@x.com')?.subject).toBe('Redefinição de senha do Morada');
    expect(resetTokenIn(sender, 'ana@x.com')).not.toBe('');
  });

  test('forgot rejects an invalid e-mail with 400', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });

    expect((await forgot(app, 'nope')).status).toBe(400);
  });

  test('forgot shares the sign-up IP limiter', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });

    for (let i = 0; i < 10; i += 1) {
      expect((await forgot(app, `u${i}@x.com`)).status).toBe(204);
    }

    expect((await forgot(app, 'u10@x.com')).status).toBe(429);
    const signup = await postJson(
      app,
      '/auth/signup',
      { name: 'Ana', email: 'ana@x.com', password: 'senha-segura-1' },
      { 'X-Forwarded-For': '1.1.1.1' },
    );
    expect(signup.status).toBe(429);
    expect((await forgot(app, 'u10@x.com', '2.2.2.2')).status).toBe(204);
  });

  test('reset changes the password, verifies the e-mail and logs in', async () => {
    const sender = new InMemoryEmailSender();
    const app = await makeApp({ email: sender });
    await insertEmailUser('ana@x.com', 'senha-antiga-1');
    await forgot(app, 'ana@x.com');

    const res = await postJson(app, '/auth/password/reset', {
      token: resetTokenIn(sender, 'ana@x.com'),
      password: 'senha-nova-123',
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ condos: [], emailVerified: true });
    expect((await loginWith(app, { login: 'ana@x.com', password: 'senha-antiga-1' })).status).toBe(
      401,
    );
    expect((await loginWith(app, { login: 'ana@x.com', password: 'senha-nova-123' })).status).toBe(
      200,
    );
    expect(await count("users WHERE email = 'ana@x.com' AND email_verified_at IS NOT NULL")).toBe(
      1,
    );
  });

  test('reset ends earlier sessions and the returned session works', async () => {
    const sender = new InMemoryEmailSender();
    const app = await makeApp({ email: sender });
    await insertEmailUser('ana@x.com', 'senha-antiga-1');
    const before = await loginWith(app, { login: 'ana@x.com', password: 'senha-antiga-1' });
    const oldCookie = sessionCookieOf(before);
    expect((await app.request('/me', { headers: { Cookie: oldCookie } })).status).toBe(200);
    await forgot(app, 'ana@x.com');

    const res = await postJson(app, '/auth/password/reset', {
      token: resetTokenIn(sender, 'ana@x.com'),
      password: 'senha-nova-123',
    });

    const stale = await app.request('/me', { headers: { Cookie: oldCookie } });
    expect(stale.status).toBe(401);
    expect(await stale.json()).toEqual({ error: 'Sessão inválida' });
    const fresh = await app.request('/me', { headers: { Cookie: sessionCookieOf(res) } });
    expect(fresh.status).toBe(200);
  });

  test('a reused token is 404', async () => {
    const sender = new InMemoryEmailSender();
    const app = await makeApp({ email: sender });
    await insertEmailUser('ana@x.com', 'senha-antiga-1');
    await forgot(app, 'ana@x.com');
    const token = resetTokenIn(sender, 'ana@x.com');
    await postJson(app, '/auth/password/reset', { token, password: 'senha-nova-123' });

    const again = await postJson(app, '/auth/password/reset', { token, password: 'outra-123' });

    expect(again.status).toBe(404);
    expect(await again.json()).toEqual({ error: 'Link inválido ou expirado' });
  });

  test('a token older than one hour is 404', async () => {
    const sender = new InMemoryEmailSender();
    const app = await makeApp({ email: sender, now: () => new Date('2026-01-01T00:00:00.000Z') });
    await insertEmailUser('ana@x.com', 'senha-antiga-1');
    await forgot(app, 'ana@x.com');
    const lateApp = await buildApp(makePostgresRepositories(pool), {
      email: sender,
      now: () => new Date('2026-01-01T01:00:00.000Z'),
    });

    const res = await postJson(lateApp, '/auth/password/reset', {
      token: resetTokenIn(sender, 'ana@x.com'),
      password: 'senha-nova-123',
    });

    expect(res.status).toBe(404);
  });

  test('a short password is 400 and keeps the token usable; a malformed token is 404', async () => {
    const sender = new InMemoryEmailSender();
    const app = await makeApp({ email: sender });
    await insertEmailUser('ana@x.com', 'senha-antiga-1');
    await forgot(app, 'ana@x.com');
    const token = resetTokenIn(sender, 'ana@x.com');

    expect((await postJson(app, '/auth/password/reset', { token, password: 'curta' })).status).toBe(
      400,
    );
    expect(
      (await postJson(app, '/auth/password/reset', { token: 42, password: 'senha-nova-123' }))
        .status,
    ).toBe(404);
    expect(
      (await postJson(app, '/auth/password/reset', { token, password: 'senha-nova-123' })).status,
    ).toBe(200);
  });

  test('confirm rejects a non-string token with 404', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });

    expect((await postJson(app, '/auth/email/confirm', { token: 42 })).status).toBe(404);
  });

  test('sign-up on an unverified e-mail replaces the credentials and ends its sessions', async () => {
    const sender = new InMemoryEmailSender();
    const app = await makeApp({ email: sender });
    const intruder = { name: 'Intruso', email: 'ana@x.com', password: 'senha-intruso-1' };
    await postJson(app, '/auth/signup', intruder, { 'X-Forwarded-For': '9.9.9.9' });
    const intruderSession = sessionCookieOf(
      await loginWith(app, { login: 'ana@x.com', password: 'senha-intruso-1' }),
    );

    const res = await postJson(
      app,
      '/auth/signup',
      { name: 'Ana', email: 'ana@x.com', password: 'senha-da-ana-1' },
      { 'X-Forwarded-For': '1.1.1.1' },
    );

    expect(res.status).toBe(202);
    expect((await app.request('/me', { headers: { Cookie: intruderSession } })).status).toBe(401);
    expect((await loginWith(app, { login: 'ana@x.com', password: 'senha-intruso-1' })).status).toBe(
      401,
    );
    const confirmed = await postJson(app, '/auth/email/confirm', {
      token: /confirmar-email\/([\w-]+)/.exec(sender.lastTo('ana@x.com')?.text ?? '')?.[1],
    });
    expect(confirmed.status).toBe(200);
    const me = await app.request('/me', { headers: { Cookie: sessionCookieOf(confirmed) } });
    expect(await me.json()).toMatchObject({ name: 'Ana', emailVerified: true });
  });

  test('a session token without a version is rejected', async () => {
    const app = await makeApp();
    const now = Math.floor(Date.now() / 1000);
    const legacy = await sign(
      { uid: 'u-admin', iat: now, exp: now + 60 },
      config.jwtSecret,
      'HS256',
    );

    const res = await app.request('/me', { headers: { Cookie: `session=${legacy}` } });

    expect(res.status).toBe(401);
  });
});
