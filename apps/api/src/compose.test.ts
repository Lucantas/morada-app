import { sign } from 'hono/jwt';

import { moneyActivityResolver } from './activity/adapters/http/money-activity';
import { buildApp } from './compose';
import { config } from './platform/config';
import {
  DisabledEmailSender,
  EmailDeliveryError,
  type EmailSender,
} from './platform/email/email-sender';
import { InMemoryEmailSender } from './platform/email/in-memory-email-sender';
import { migrate } from './platform/postgres/migrate';
import { hashToken } from './platform/tokens';
import { createPool } from './platform/postgres/pool';
import { makePostgresRepositories } from './repositories';
import { adminCredentials } from './seed-data';
import { resetPg } from './test-support/pg';
import { createTestCondo } from './test-support/condos';
import { BcryptPasswordHasher } from './users/adapters/bcrypt/bcrypt-password-hasher';
import { PostgresUserRepository } from './users/adapters/postgres/user-repository';
import { residentCredentials, seedFixtures, TEST_CONDO_ID } from './test-fixtures';

const P = `/api/condos/${TEST_CONDO_ID}`;

const ADMIN_SUMMARY = {
  id: TEST_CONDO_ID,
  name: `Condomínio ${TEST_CONDO_ID}`,
  role: 'admin',
  condoRole: 'administrador',
  permissions: [
    'view_building',
    'publish_notices',
    'manage_residents',
    'manage_money',
    'manage_fees',
    'manage_condo',
    'view_activity',
  ],
  hasHome: false,
  organizationId: `org-${TEST_CONDO_ID}`,
  orgRole: 'owner',
  onboardingPending: false,
};

const RESIDENT_SUMMARY = {
  id: TEST_CONDO_ID,
  name: `Condomínio ${TEST_CONDO_ID}`,
  role: 'resident',
  condoRole: 'morador',
  permissions: [],
  hasHome: false,
  organizationId: `org-${TEST_CONDO_ID}`,
  orgRole: null,
  onboardingPending: false,
};

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
    expect((await other.threads.getById('th-foreign', 'u-any'))?.messages).toEqual([]);
  });

  test('cross-condo settings are isolated', async () => {
    const app = await makeApp();
    await createTestCondo(pool, 'condo-other');
    const other = makePostgresRepositories(pool).forCondo('condo-other');
    await other.settings.save({
      monthlyFeeCents: 99000,
      dueDay: 3,
      pix: null,
      openingBalance: null,
    });
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

    expect(await read.json()).toEqual({
      monthlyFeeCents: 15000,
      dueDay: 15,
      pix: null,
      openingBalance: null,
    });
    expect(update.status).toBe(200);
    expect(await other.settings.get()).toEqual({
      monthlyFeeCents: 99000,
      dueDay: 3,
      pix: null,
      openingBalance: null,
    });
    const own = await app.request(`${P}/settings`, { headers });
    expect(await own.json()).toEqual({
      monthlyFeeCents: 20000,
      dueDay: 10,
      pix: null,
      openingBalance: null,
    });
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
    expect(await adminCondos.json()).toEqual([ADMIN_SUMMARY]);
    expect(await residentCondos.json()).toEqual([RESIDENT_SUMMARY]);
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
      condos: [ADMIN_SUMMARY],
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

  async function verifiedEmailAuth(app: App, email: string): Promise<Auth> {
    await insertEmailUser(email, 'senha-segura-1');
    await pool.query('UPDATE users SET email_verified_at = now() WHERE email = $1', [email]);
    const res = await loginWith(app, { login: email, password: 'senha-segura-1' });
    const cookies = res.headers.getSetCookie();
    const csrf = parseCookie(cookies, 'csrf');
    return { cookie: `session=${parseCookie(cookies, 'session')}; csrf=${csrf}`, csrf };
  }

  async function createCondo(app: App, auth: Auth, body: unknown): Promise<Response> {
    return app.request('/me/condos', {
      method: 'POST',
      headers: {
        Cookie: auth.cookie,
        'X-CSRF-Token': auth.csrf,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  test('POST /me/condos refuses an unconfirmed e-mail', async () => {
    const app = await makeApp();
    await insertEmailUser('ana@x.com', 'senha-segura-1');
    const login1 = await loginWith(app, { login: 'ana@x.com', password: 'senha-segura-1' });
    const cookies = login1.headers.getSetCookie();
    const csrf = parseCookie(cookies, 'csrf');
    const auth = { cookie: `session=${parseCookie(cookies, 'session')}; csrf=${csrf}`, csrf };

    const res = await createCondo(app, auth, { name: 'Ipê' });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Confirme seu e-mail antes de criar um condomínio' });
  });

  test('POST /me/condos requires CSRF and a session', async () => {
    const app = await makeApp();
    const auth = await verifiedEmailAuth(app, 'ana@x.com');

    const noCsrf = await app.request('/me/condos', {
      method: 'POST',
      headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ipê' }),
    });
    const anonymous = await app.request('/me/condos', { method: 'POST' });

    expect(noCsrf.status).toBe(403);
    expect(anonymous.status).toBe(401);
  });

  test('a verified user creates a condominium, listed in /me as admin', async () => {
    const app = await makeApp();
    const auth = await verifiedEmailAuth(app, 'ana@x.com');

    const res = await createCondo(app, auth, { name: '  Residencial Ipê ' });
    const me = await app.request('/me', { headers: { Cookie: auth.cookie } });

    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: string; name: string; role: string };
    expect(created).toMatchObject({
      name: 'Residencial Ipê',
      role: 'admin',
      condoRole: 'administrador',
      permissions: ADMIN_SUMMARY.permissions,
      hasHome: false,
      organizationId: expect.any(String),
      orgRole: 'owner',
    });
    expect(((await me.json()) as { condos: unknown[] }).condos).toEqual([created]);
  });

  test('POST /me/condos creates the building', async () => {
    const app = await makeApp();
    const auth = await verifiedEmailAuth(app, 'ana@x.com');

    const res = await createCondo(app, auth, {
      name: 'Residencial Ipê',
      structure: { blocks: [{ name: null, floors: 4, perFloor: 4 }] },
      monthlyFeeCents: 35000,
      dueDay: 10,
      pix: {
        keyType: 'cpf',
        key: '529.982.247-25',
        receiverName: 'Condominio Ipe',
        city: 'Sao Paulo',
      },
    });
    const created = (await res.json()) as { id: string };
    const apartments = await pool.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM apartments WHERE condominium_id = $1',
      [created.id],
    );
    const settings = await app.request(`/api/condos/${created.id}/settings`, {
      headers: { Cookie: auth.cookie },
    });

    expect(res.status).toBe(201);
    expect(apartments.rows[0]?.n).toBe(16);
    expect(await settings.json()).toEqual({
      monthlyFeeCents: 35000,
      dueDay: 10,
      pix: {
        keyType: 'cpf',
        key: '52998224725',
        receiverName: 'Condominio Ipe',
        city: 'Sao Paulo',
      },
      openingBalance: null,
    });
  });

  test('long block names make apartments that take a resident, and "Bloco " is dropped', async () => {
    const app = await makeApp();
    const auth = await verifiedEmailAuth(app, 'ana@x.com');
    const longName = 'Residencial Jardim Primavera I';
    const res = await createCondo(app, auth, {
      name: 'Residencial Ipê',
      structure: {
        blocks: [
          { name: 'Bloco A', floors: 1, perFloor: 1 },
          { name: longName, floors: 60, perFloor: 20 },
        ],
      },
    });
    const created = (await res.json()) as { id: string };
    const headers = {
      Cookie: auth.cookie,
      'X-CSRF-Token': auth.csrf,
      'Content-Type': 'application/json',
    };
    const longest = `Apto 6020 · Bloco ${longName}`;

    const saved = await app.request(`/api/condos/${created.id}/residents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Ana', apt: longest, phone: '', email: '', status: 'em_dia' }),
    });
    const blocks = await pool.query<{ block: string }>(
      'SELECT DISTINCT block FROM apartments WHERE condominium_id = $1 ORDER BY block',
      [created.id],
    );
    const building = (await (
      await app.request(`/api/condos/${created.id}/building`, { headers })
    ).json()) as { blocks: { floors: { apartments: { label: string; state: string }[] }[] }[] };
    const window = building.blocks
      .flatMap((b) => b.floors.flatMap((f) => f.apartments))
      .find((a) => a.label === longest);

    expect(res.status).toBe(201);
    expect(saved.status).toBe(201);
    expect(blocks.rows.map((row) => row.block)).toEqual(['A', longName]);
    expect(window?.state).toBe('ocupado');
  });

  test('new condo is pending until completed', async () => {
    const app = await makeApp();
    const auth = await verifiedEmailAuth(app, 'ana@x.com');
    const complete = (id: string) =>
      app.request(`/api/condos/${id}/onboarding/complete`, {
        method: 'POST',
        headers: { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrf },
      });
    const listed = async () =>
      (await (await app.request('/me/condos', { headers: { Cookie: auth.cookie } })).json()) as {
        onboardingPending: boolean;
      }[];

    const created = (await (await createCondo(app, auth, { name: 'Ipê' })).json()) as {
      id: string;
      onboardingPending: boolean;
    };
    const pendingBefore = await listed();
    const first = await complete(created.id);
    const pendingAfter = await listed();
    const second = await complete(created.id);

    expect(created.onboardingPending).toBe(true);
    expect(pendingBefore[0]?.onboardingPending).toBe(true);
    expect(first.status).toBe(204);
    expect(pendingAfter[0]?.onboardingPending).toBe(false);
    expect(second.status).toBe(204);
  });

  test('a second condominium reuses the same organization', async () => {
    const app = await makeApp();
    const auth = await verifiedEmailAuth(app, 'ana@x.com');

    await createCondo(app, auth, { name: 'Primeiro' });
    const second = await createCondo(app, auth, { name: 'Segundo' });

    expect(second.status).toBe(201);
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(DISTINCT c.organization_id)::int AS n FROM condominiums c
       JOIN condo_roles r ON r.condominium_id = c.id WHERE r.user_id = 'u-ana'`,
    );
    expect(rows[0]?.n).toBe(1);
  });

  test('a blank name answers 400 and creates nothing', async () => {
    const app = await makeApp();
    const auth = await verifiedEmailAuth(app, 'ana@x.com');
    const before = await count('organizations');

    const res = await createCondo(app, auth, { name: '   ' });

    expect(res.status).toBe(400);
    expect(await count('organizations')).toBe(before);
  });

  test('a user who is only a morador elsewhere gets their own organization', async () => {
    const app = await makeApp();
    const auth = await verifiedEmailAuth(app, 'ana@x.com');
    await pool.query(
      "INSERT INTO condo_roles (id, condominium_id, user_id, role, resident_id) SELECT 'cr-ana', $1, 'u-ana', 'morador', id FROM residents WHERE condominium_id = $1 LIMIT 1",
      [TEST_CONDO_ID],
    );

    const res = await createCondo(app, auth, { name: 'Meu Prédio' });
    const { rows } = await pool.query<{ organization_id: string }>(
      "SELECT organization_id FROM condominiums WHERE name = 'Meu Prédio'",
    );

    expect(res.status).toBe(201);
    expect(rows[0]?.organization_id).not.toBe(`org-${TEST_CONDO_ID}`);
    const { rows: members } = await pool.query(
      "SELECT 1 FROM organization_members WHERE user_id = 'u-ana' AND role = 'owner'",
    );
    expect(members).toHaveLength(1);
  });

  describe('GET /me/street', () => {
    type StreetBody = { name: string | null; condos: { id: string }[]; homes: unknown[] };

    async function streetFor(app: App, auth: Auth): Promise<Response> {
      return app.request('/me/street', { headers: { Cookie: auth.cookie } });
    }

    async function streetBody(app: App, auth: Auth): Promise<StreetBody> {
      return (await streetFor(app, auth)).json() as Promise<StreetBody>;
    }

    async function orgWithTwoCondos(memberRole: 'owner' | 'member'): Promise<void> {
      await createTestCondo(pool, 'street-1', { orgId: 'org-street', name: 'Rua Um' });
      await createTestCondo(pool, 'street-2', { orgId: 'org-street', name: 'Rua Dois' });
      await pool.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role)
         VALUES ('om-ana', 'org-street', 'u-ana', $1)`,
        [memberRole],
      );
    }

    test('requires authentication', async () => {
      const res = await (await makeApp()).request('/me/street');
      expect(res.status).toBe(401);
    });

    test('returns staff condos with facts and homes without them', async () => {
      const app = await makeApp();
      const admin = await authFor(app, adminCredentials);
      const resident = await authFor(app, residentCredentials);

      const adminBody = await streetBody(app, admin);
      const residentBody = await streetBody(app, resident);

      expect(adminBody.condos).toEqual([
        {
          ...ADMIN_SUMMARY,
          pendencies: expect.objectContaining({ unreadThreads: expect.any(Number) }),
          windows: [],
        },
      ]);
      expect(adminBody.homes).toEqual([]);
      expect(residentBody.condos).toEqual([]);
      expect(residentBody.homes).toEqual([RESIDENT_SUMMARY]);
    });

    test('an organization owner sees every condominium of the organization', async () => {
      const app = await makeApp();
      const auth = await verifiedEmailAuth(app, 'ana@x.com');
      await orgWithTwoCondos('owner');

      const res = await streetFor(app, auth);
      const body = (await res.json()) as StreetBody;

      expect(res.status).toBe(200);
      expect(body.name).toBe('Ana');
      expect(body.condos.map((c) => c.id)).toEqual(['street-2', 'street-1']);
    });

    test('an organization member sees only the condominiums assigned to them', async () => {
      const app = await makeApp();
      const auth = await verifiedEmailAuth(app, 'ana@x.com');
      await orgWithTwoCondos('member');
      await pool.query(
        `INSERT INTO condo_roles (id, condominium_id, user_id, role, resident_id)
         VALUES ('cr-ana-street', 'street-1', 'u-ana', 'administrador', NULL)`,
      );

      const body = await streetBody(app, auth);

      expect(body.condos.map((c) => c.id)).toEqual(['street-1']);
      expect(body.homes).toEqual([]);
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

  test('logout ends the session server-side, so a copied cookie stops working', async () => {
    const app = await makeApp();
    const auth = await authFor(app, adminCredentials);

    await app.request('/auth/logout', {
      method: 'POST',
      headers: { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrf },
    });
    const replay = await app.request('/me', { headers: { Cookie: auth.cookie } });

    expect(replay.status).toBe(401);
    expect(await count("users WHERE id = 'u-admin' AND session_version = 1")).toBe(1);
  });

  test('logout with an invalid session still answers 204 and bumps nothing', async () => {
    const app = await makeApp();
    const auth = await authFor(app, adminCredentials);

    const out = await app.request('/auth/logout', {
      method: 'POST',
      headers: { Cookie: `session=garbage; csrf=${auth.csrf}`, 'X-CSRF-Token': auth.csrf },
    });

    expect(out.status).toBe(204);
    expect(await count('users WHERE session_version <> 0')).toBe(0);
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

describe('Morada API — derived logins are no longer provisioned', () => {
  test('the resident-login provisioning route is gone', async () => {
    const app = await makeApp();
    const auth = await adminAuthFor(app);

    const res = await auth(`${P}/users`, {
      method: 'POST',
      body: JSON.stringify({ residentId: 'r-3' }),
    });

    expect(res.status).toBe(404);
    expect(await count("users WHERE resident_id = 'r-3'")).toBe(0);
  });
});

describe('Morada API — admin reads and resets resident logins', () => {
  test('an admin reads the username of a resident that has a login', async () => {
    const app = await makeApp();
    const auth = await adminAuthFor(app);
    const res = await auth(`${P}/residents/${residentCredentials.residentId}/login`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ username: residentCredentials.username });
  });

  test('reading the login of a resident without one answers a null username', async () => {
    const app = await makeApp();
    const auth = await adminAuthFor(app);
    const res = await auth(`${P}/residents/r-3/login`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ username: null });
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

  test("an admin reset ends the resident's existing sessions", async () => {
    const app = await makeApp();
    const resident = await authFor(app, residentCredentials);
    const meBefore = await app.request('/me', { headers: { Cookie: resident.cookie } });
    expect(meBefore.status).toBe(200);
    const auth = await adminAuthFor(app);

    await auth(`${P}/residents/${residentCredentials.residentId}/login/reset`, { method: 'POST' });

    expect((await app.request('/me', { headers: { Cookie: resident.cookie } })).status).toBe(401);
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
      condos: [RESIDENT_SUMMARY],
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
    expect(await res.json()).toEqual({
      monthlyFeeCents: 15000,
      dueDay: 15,
      pix: null,
      openingBalance: null,
    });
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
    expect(put.status).toBe(201);

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
    expect(noProof.status).toBe(201);
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
    await postJson(app, '/auth/email/confirm', {
      token: confirmTokenIn(sender, 'ana@x.com'),
      password: signupBody.password,
    });

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

    const res = await postJson(app, '/auth/email/confirm', {
      token,
      password: signupBody.password,
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ condos: [], emailVerified: true });
    expect(res.headers.getSetCookie().some((c) => c.startsWith('session='))).toBe(true);
    const { rows } = await pool.query('SELECT email_verified_at FROM users WHERE email = $1', [
      'ana@x.com',
    ]);
    expect(rows[0]?.email_verified_at).toBeInstanceOf(Date);

    const again = await postJson(app, '/auth/email/confirm', {
      token,
      password: signupBody.password,
    });
    expect(again.status).toBe(404);
    expect(await again.json()).toEqual({ error: 'Link inválido ou expirado' });
  });

  test('confirming needs the account password; a wrong one is 401 and keeps the link', async () => {
    const sender = new InMemoryEmailSender();
    const app = await makeApp({ email: sender });
    await signup(app);
    const token = confirmTokenIn(sender, 'ana@x.com');

    const wrong = await postJson(app, '/auth/email/confirm', { token, password: 'outra-senha-1' });
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ error: 'Usuário ou senha inválidos' });
    expect((await postJson(app, '/auth/email/confirm', { token })).status).toBe(400);

    const right = await postJson(app, '/auth/email/confirm', {
      token,
      password: signupBody.password,
    });
    expect(right.status).toBe(200);
  });

  test('the owner cannot confirm an account an intruder created with their e-mail', async () => {
    const sender = new InMemoryEmailSender();
    const app = await makeApp({ email: sender });
    await signup(app, { ...signupBody, password: 'senha-do-intruso' });

    const res = await postJson(app, '/auth/email/confirm', {
      token: confirmTokenIn(sender, 'ana@x.com'),
      password: signupBody.password,
    });

    expect(res.status).toBe(401);
    expect(await count("users WHERE email = 'ana@x.com' AND email_verified_at IS NULL")).toBe(1);
  });

  test('an unknown or malformed token is 404', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });

    expect(
      (await postJson(app, '/auth/email/confirm', { token: 'nope', password: 'x' })).status,
    ).toBe(404);
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

    expect(
      (await postJson(lateApp, '/auth/email/confirm', { token, password: signupBody.password }))
        .status,
    ).toBe(404);
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

    expect(
      (await postJson(app, '/auth/email/confirm', { token: first, password: signupBody.password }))
        .status,
    ).toBe(404);
    const confirmed = await postJson(app, '/auth/email/confirm', {
      token: second,
      password: signupBody.password,
    });
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

    expect((await postJson(app, '/auth/email/confirm', { token: 42, password: 'x' })).status).toBe(
      404,
    );
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
      password: 'senha-da-ana-1',
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

describe('Resident invitations', () => {
  const APP_URL = config.appUrl;

  async function adminSession(app: App) {
    const auth = await authFor(app, adminCredentials);
    return { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrf, 'Content-Type': 'application/json' };
  }

  function post(app: App, path: string, headers: Record<string, string>, body?: unknown) {
    return app.request(`${P}${path}`, {
      method: 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  function tokenIn(link: string): string {
    return link.slice(`${APP_URL}/#/convite/`.length);
  }

  async function setResident(id: string, fields: { phone?: string; email?: string }) {
    await pool.query(
      'UPDATE residents SET phone = COALESCE($2, phone), email = COALESCE($3, email) WHERE id = $1',
      [id, fields.phone ?? null, fields.email ?? null],
    );
  }

  test('creates a pending invitation, returns the link once and e-mails the resident', async () => {
    const sender = new InMemoryEmailSender();
    const now = new Date('2026-10-23T12:00:00.000Z');
    const app = await makeApp({ email: sender, now: () => now });
    const headers = await adminSession(app);

    const res = await post(app, '/residents/r-1/invitation', headers, {});

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      status: string;
      email: string;
      expiresAt: string;
      link: string;
      whatsappUrl: string;
    };
    expect(body).toMatchObject({
      status: 'pendente',
      email: 'maria@email.com',
      emailSent: true,
      expiresAt: '2026-10-30T12:00:00.000Z',
    });
    expect(body.link).toMatch(new RegExp(`^${APP_URL}/#/convite/[\\w-]{43}$`));
    const mail = sender.lastTo('maria@email.com');
    expect(mail?.subject).toBe('Você foi convidado para o Condomínio condo-test');
    expect(mail?.text).toContain(body.link);
    const { rows } = await pool.query(
      'SELECT token_hash, created_by, resident_id, condominium_id FROM invitations',
    );
    expect(rows).toEqual([
      {
        token_hash: hashToken(tokenIn(body.link)),
        created_by: 'u-admin',
        resident_id: 'r-1',
        condominium_id: TEST_CONDO_ID,
      },
    ]);
  });

  test('uses the e-mail from the body, normalized, instead of the stored one', async () => {
    const sender = new InMemoryEmailSender();
    const app = await makeApp({ email: sender });
    const headers = await adminSession(app);

    const res = await post(app, '/residents/r-1/invitation', headers, { email: '  Nova@X.com ' });

    expect(res.status).toBe(201);
    expect(((await res.json()) as { email: string }).email).toBe('nova@x.com');
    expect(sender.sent.map((m) => m.to)).toEqual(['nova@x.com']);
  });

  test('rejects an invalid e-mail in the body with 400 and writes nothing', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });
    const headers = await adminSession(app);

    const res = await post(app, '/residents/r-1/invitation', headers, { email: 'nope' });

    expect(res.status).toBe(400);
    expect(await count('invitations')).toBe(0);
  });

  test('sends no e-mail when neither the body nor the resident has a valid one', async () => {
    const sender = new InMemoryEmailSender();
    const app = await makeApp({ email: sender });
    await setResident('r-1', { email: 'not-an-email' });
    const headers = await adminSession(app);

    const res = await post(app, '/residents/r-1/invitation', headers);

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ email: null, emailSent: false });
    expect(sender.sent).toEqual([]);
  });

  test('whatsappUrl carries the Brazilian country code and the greeting', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });
    await setResident('r-1', { phone: '(11) 98888-7777' });
    const headers = await adminSession(app);

    const res = await post(app, '/residents/r-1/invitation', headers, {});

    const body = (await res.json()) as { link: string; whatsappUrl: string };
    const message = `Olá, Maria! Seu acesso ao Condomínio condo-test no Morada: ${body.link}`;
    expect(body.whatsappUrl).toBe(
      `https://wa.me/5511988887777?text=${encodeURIComponent(message)}`,
    );
  });

  test('whatsappUrl falls back to the generic link without a phone', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });
    await setResident('r-1', { phone: '' });
    const headers = await adminSession(app);

    const res = await post(app, '/residents/r-1/invitation', headers, {});

    expect(((await res.json()) as { whatsappUrl: string }).whatsappUrl).toMatch(
      /^https:\/\/wa\.me\/\?text=/,
    );
  });

  test('with e-mail off, an e-mail invite still answers 201 with the link and emailSent false', async () => {
    const app = await makeApp({ email: new DisabledEmailSender() });
    const headers = await adminSession(app);

    const res = await post(app, '/residents/r-1/invitation', headers, { email: 'a@x.com' });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { email: string; emailSent: boolean; link: string };
    expect(body).toMatchObject({ email: 'a@x.com', emailSent: false });
    expect(body.link).toMatch(new RegExp(`^${APP_URL}/#/convite/`));
    const { rows } = await pool.query('SELECT status, email FROM invitations');
    expect(rows).toEqual([{ status: 'pendente', email: 'a@x.com' }]);
  });

  test('a failed delivery still answers 201 with emailSent false and is logged', async () => {
    const failure = new EmailDeliveryError(500);
    const failing: EmailSender = {
      send: () => Promise.reject(failure),
      isAvailable: () => true,
    };
    const app = await makeApp({ email: failing });
    const headers = await adminSession(app);
    const logged = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await post(app, '/residents/r-1/invitation', headers);

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ email: 'maria@email.com', emailSent: false });
    expect(logged).toHaveBeenCalledWith('E-mail delivery failed:', failure);
    logged.mockRestore();
  });

  test('a malformed JSON body answers 400 and writes nothing', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });
    const headers = await adminSession(app);

    const res = await app.request(`${P}/residents/r-1/invitation`, {
      method: 'POST',
      headers,
      body: '{nope',
    });

    expect(res.status).toBe(400);
    expect(await count('invitations')).toBe(0);
  });

  test('the 31st invitation one admin creates within an hour is rate limited', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });
    const headers = await adminSession(app);

    const statuses: number[] = [];
    for (let i = 0; i < 30; i += 1) {
      statuses.push((await post(app, '/residents/r-1/invitation', headers, {})).status);
    }
    const blocked = await post(app, '/residents/r-1/invitation', headers, {});

    expect(statuses).toEqual(Array(30).fill(201));
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: 'Muitas tentativas, tente mais tarde' });
    expect(await count('invitations')).toBe(30);
  });

  test('GET returns null, then the status without the link or token', async () => {
    const now = new Date('2026-10-23T12:00:00.000Z');
    const app = await makeApp({ email: new InMemoryEmailSender(), now: () => now });
    const headers = await adminSession(app);
    const none = await app.request(`${P}/residents/r-1/invitation`, { headers });
    await post(app, '/residents/r-1/invitation', headers, {});

    const res = await app.request(`${P}/residents/r-1/invitation`, { headers });

    expect(none.status).toBe(200);
    expect(await none.json()).toBeNull();
    expect(await res.json()).toEqual({
      status: 'pendente',
      email: 'maria@email.com',
      expiresAt: '2026-10-30T12:00:00.000Z',
    });
  });

  test('GET reports expirado once the invitation passes its expiry', async () => {
    let now = new Date('2026-10-23T12:00:00.000Z');
    const app = await makeApp({ email: new InMemoryEmailSender(), now: () => now });
    const headers = await adminSession(app);
    await post(app, '/residents/r-1/invitation', headers, {});
    now = new Date('2026-10-30T12:00:00.000Z');

    const res = await app.request(`${P}/residents/r-1/invitation`, { headers });

    expect(((await res.json()) as { status: string }).status).toBe('expirado');
  });

  test('inviting again revokes the previous invitation', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });
    const headers = await adminSession(app);
    await post(app, '/residents/r-1/invitation', headers, {});

    await post(app, '/residents/r-1/invitation', headers, {});

    const { rows } = await pool.query('SELECT status FROM invitations ORDER BY created_at');
    expect(rows).toEqual([{ status: 'revogado' }, { status: 'pendente' }]);
  });

  test('revoke answers 204 and marks the invitation revogado', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });
    const headers = await adminSession(app);
    await post(app, '/residents/r-1/invitation', headers, {});

    const res = await post(app, '/residents/r-1/invitation/revoke', headers);

    expect(res.status).toBe(204);
    const status = await app.request(`${P}/residents/r-1/invitation`, { headers });
    expect(((await status.json()) as { status: string }).status).toBe('revogado');
  });

  test('a resident session cannot manage invitations', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });
    const auth = await authFor(app, residentCredentials);
    const headers = {
      Cookie: auth.cookie,
      'X-CSRF-Token': auth.csrf,
      'Content-Type': 'application/json',
    };

    const create = await post(app, '/residents/r-1/invitation', headers, {});
    const read = await app.request(`${P}/residents/r-1/invitation`, { headers });
    const revoke = await post(app, '/residents/r-1/invitation/revoke', headers);

    expect([create.status, read.status, revoke.status]).toEqual([403, 403, 403]);
    expect(await count('invitations')).toBe(0);
  });

  test('foreign or unknown residents answer 404 and write nothing', async () => {
    const sender = new InMemoryEmailSender();
    const app = await makeApp({ email: sender });
    await createTestCondo(pool, 'condo-other');
    const other = makePostgresRepositories(pool).forCondo('condo-other');
    await other.residents.save({
      id: 'r-foreign',
      name: 'Forasteiro',
      apt: 'Apto 900',
      phone: '',
      email: 'f@x.com',
      status: 'em_dia',
    });
    const headers = await adminSession(app);

    const create = await post(app, '/residents/r-foreign/invitation', headers, {});
    const read = await app.request(`${P}/residents/r-foreign/invitation`, { headers });
    const revoke = await post(app, '/residents/r-foreign/invitation/revoke', headers);
    const unknown = await post(app, '/residents/ghost/invitation', headers, {});

    expect([create.status, read.status, revoke.status, unknown.status]).toEqual([
      404, 404, 404, 404,
    ]);
    expect(await count('invitations')).toBe(0);
    expect(sender.sent).toEqual([]);
  });

  test('condominium B invitations are invisible and untouched by condominium A admin', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });
    await createTestCondo(pool, 'condo-other');
    const other = makePostgresRepositories(pool).forCondo('condo-other');
    await other.residents.save({
      id: 'r-foreign',
      name: 'Forasteiro',
      apt: 'Apto 900',
      phone: '',
      email: '',
      status: 'em_dia',
    });
    await other.invitations.create({
      residentId: 'r-foreign',
      email: null,
      tokenHash: 'hb',
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      createdBy: 'u-admin',
    });
    const headers = await adminSession(app);

    await post(app, '/residents/r-foreign/invitation/revoke', headers);

    expect((await other.invitations.latestForResident('r-foreign'))?.status).toBe('pendente');
  });
});

describe('Accepting an invitation', () => {
  const APP_URL = config.appUrl;
  const CONDO = RESIDENT_SUMMARY;

  async function adminHeaders(app: App) {
    const auth = await authFor(app, adminCredentials);
    return { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrf, 'Content-Type': 'application/json' };
  }

  async function invite(app: App, body: { email?: string } = {}): Promise<string> {
    const res = await app.request(`${P}/residents/r-1/invitation`, {
      method: 'POST',
      headers: await adminHeaders(app),
      body: JSON.stringify(body),
    });
    const { link } = (await res.json()) as { link: string };
    return link.slice(`${APP_URL}/#/convite/`.length);
  }

  async function whatsappInvite(app: App): Promise<string> {
    await pool.query("UPDATE residents SET email = '' WHERE id = 'r-1'");
    return invite(app);
  }

  function accept(app: App, token: string, body: unknown, ip = '9.9.9.9') {
    return app.request(`/auth/invitations/${token}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify(body),
    });
  }

  function preview(app: App, token: string, ip = '9.9.9.9') {
    return app.request(`/auth/invitations/${token}`, { headers: { 'X-Forwarded-For': ip } });
  }

  function cookieOf(res: Response): string {
    const setCookies = res.headers.getSetCookie();
    return `session=${parseCookie(setCookies, 'session')}`;
  }

  const newAccount = { password: 'senha-segura-1', name: 'Maria Ribeiro' };

  test('the preview shows the condo, resident and apartment, never the token or the phone', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });
    const token = await invite(app);

    const res = await preview(app, token);

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({
      role: 'morador',
      targetName: CONDO.name,
      condoName: CONDO.name,
      residentName: 'Maria Ribeiro',
      apt: 'Apto 302',
      email: 'maria@email.com',
      accountExists: false,
    });
    expect(text).not.toContain(token);
    expect(text).not.toContain('90000-0001');
    const unknown = await preview(app, 'nao-existe');
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: 'Convite inválido ou expirado' });
  });

  test('an e-mail invite with a new account logs in verified with the condo listed', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });
    const token = await invite(app);

    const res = await accept(app, token, newAccount);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      condos: [CONDO],
      emailVerified: true,
      invitedCondoId: CONDO.id,
    });
    const me = await app.request('/me', { headers: { Cookie: cookieOf(res) } });
    expect(me.status).toBe(200);
    expect(await count("invitations WHERE status = 'aceito'")).toBe(1);
  });

  test('accept is single use', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });
    const token = await invite(app);
    await accept(app, token, newAccount);

    const again = await accept(app, token, { ...newAccount, email: 'outra@x.com' });

    expect(again.status).toBe(404);
    expect(await again.json()).toEqual({ error: 'Convite inválido ou expirado' });
    expect((await preview(app, token)).status).toBe(404);
  });

  test('the legacy derived login of that resident gets 401 after acceptance', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });
    expect(
      (await login(app, residentCredentials.username, residentCredentials.password)).status,
    ).toBe(200);
    const token = await invite(app);

    await accept(app, token, newAccount);

    const legacy = await login(app, residentCredentials.username, residentCredentials.password);
    expect(legacy.status).toBe(401);
    expect(await count("condo_roles WHERE user_id = 'u-maria' AND active")).toBe(0);
  });

  test('existing account must authenticate', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });
    await insertEmailUser('ana@x.com', 'senha-da-ana');
    const token = await invite(app, { email: 'ana@x.com' });

    const preview1 = (await (await preview(app, token)).json()) as { accountExists: boolean };
    const wrong = await accept(app, token, { password: 'errada' });

    expect(preview1.accountExists).toBe(true);
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ error: 'Usuário ou senha inválidos' });
    expect(await count("invitations WHERE status = 'pendente' AND claimed_by IS NULL")).toBe(1);

    const right = await accept(app, token, { password: 'senha-da-ana' });

    expect(right.status).toBe(200);
    expect(await right.json()).toEqual({
      condos: [CONDO],
      emailVerified: true,
      invitedCondoId: CONDO.id,
    });
    expect((await app.request('/me', { headers: { Cookie: cookieOf(right) } })).status).toBe(200);
  });

  test('a WhatsApp invite with a new account waits for the e-mail; claim activates on confirmation', async () => {
    const sender = new InMemoryEmailSender();
    const app = await makeApp({ email: sender });
    const token = await whatsappInvite(app);

    const res = await accept(app, token, { ...newAccount, email: 'Maria.Nova@x.com' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      condos: [],
      emailVerified: false,
      invitedCondoId: CONDO.id,
    });
    const confirmToken =
      /confirmar-email\/([\w-]+)/.exec(sender.lastTo('maria.nova@x.com')?.text ?? '')?.[1] ?? '';
    const confirmed = await app.request('/auth/email/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: confirmToken, password: newAccount.password }),
    });
    expect(confirmed.status).toBe(200);
    expect(await confirmed.json()).toEqual({ condos: [CONDO], emailVerified: true });
    const legacy = await login(app, residentCredentials.username, residentCredentials.password);
    expect(legacy.status).toBe(401);
  });

  test('a WhatsApp invite requires the e-mail in the body', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });
    const token = await whatsappInvite(app);

    expect((await accept(app, token, newAccount)).status).toBe(400);
  });

  test('claimed invite cannot be claimed again', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });
    const token = await whatsappInvite(app);
    await accept(app, token, { ...newAccount, email: 'primeira@x.com' });

    const second = await accept(app, token, { ...newAccount, email: 'segunda@x.com' });

    expect(second.status).toBe(404);
    expect(await count("users WHERE email = 'segunda@x.com'")).toBe(0);
  });

  test('a verified login retries the activation of claimed invitations', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });
    const token = await whatsappInvite(app);
    await accept(app, token, { ...newAccount, email: 'primeira@x.com' });
    await pool.query("UPDATE users SET email_verified_at = now() WHERE email = 'primeira@x.com'");

    const res = await loginWith(app, { login: 'primeira@x.com', password: newAccount.password });

    expect(await res.json()).toEqual({ condos: [CONDO], emailVerified: true });
  });

  test('an invite for a resident who moved out is invalid, and new ones are refused', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });
    const token = await invite(app);
    await makePostgresRepositories(pool).forCondo(TEST_CONDO_ID).residents.deactivate('r-1');

    const res = await accept(app, token, newAccount);
    const again = await app.request(`${P}/residents/r-1/invitation`, {
      method: 'POST',
      headers: await adminHeaders(app),
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(404);
    expect((await preview(app, token)).status).toBe(404);
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: 'Morador inativo' });
  });

  test('an expired invite is invalid', async () => {
    let now = new Date('2026-10-23T12:00:00.000Z');
    const app = await makeApp({ email: new InMemoryEmailSender(), now: () => now });
    const token = await invite(app);
    now = new Date('2026-10-30T12:00:00.000Z');

    expect((await accept(app, token, newAccount)).status).toBe(404);
  });

  function postJson(app: App, path: string, body: unknown) {
    return app.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '8.8.8.8' },
      body: JSON.stringify(body),
    });
  }

  function linkIn(sender: InMemoryEmailSender, to: string, route: string): string {
    return new RegExp(`${route}/([\\w-]+)`).exec(sender.lastTo(to)?.text ?? '')?.[1] ?? '';
  }

  test('a sign-up takeover of the claiming account releases the claim', async () => {
    const sender = new InMemoryEmailSender();
    const app = await makeApp({ email: sender });
    const token = await whatsappInvite(app);
    await accept(app, token, { ...newAccount, email: 'vitima@x.com' });

    await postJson(app, '/auth/signup', {
      name: 'Vítima',
      email: 'vitima@x.com',
      password: 'senha-da-vitima',
    });
    const confirmed = await postJson(app, '/auth/email/confirm', {
      token: linkIn(sender, 'vitima@x.com', 'confirmar-email'),
      password: 'senha-da-vitima',
    });

    expect(await confirmed.json()).toEqual({ condos: [], emailVerified: true });
    expect(await count("invitations WHERE status = 'pendente' AND claimed_by IS NULL")).toBe(1);
  });

  test('resetting the password of an unverified claiming account releases the claim', async () => {
    const sender = new InMemoryEmailSender();
    const app = await makeApp({ email: sender });
    const token = await whatsappInvite(app);
    await accept(app, token, { ...newAccount, email: 'vitima@x.com' });

    await postJson(app, '/auth/password/forgot', { email: 'vitima@x.com' });
    const reset = await postJson(app, '/auth/password/reset', {
      token: linkIn(sender, 'vitima@x.com', 'redefinir-senha'),
      password: 'senha-da-vitima',
    });

    expect(await reset.json()).toEqual({ condos: [], emailVerified: true });
    expect(await count("invitations WHERE status = 'pendente' AND claimed_by IS NULL")).toBe(1);
  });

  test('a WhatsApp invite answers 400 to a body without a name whether or not the account exists', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });
    await insertEmailUser('ana@x.com', 'senha-da-ana');
    const token = await whatsappInvite(app);

    const existing = await accept(app, token, { email: 'ana@x.com', password: 'senha-da-ana' });
    const missing = await accept(app, token, { email: 'nova@x.com', password: 'senha-da-ana' });

    expect([existing.status, missing.status]).toEqual([400, 400]);
  });

  test('preview and accept share their own limiter, apart from sign-up', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });
    const token = await invite(app);

    const statuses: number[] = [];
    for (let i = 0; i < 10; i += 1) statuses.push((await preview(app, token, '7.7.7.7')).status);
    const blocked = await accept(app, token, newAccount, '7.7.7.7');
    const signup = await app.request('/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '7.7.7.7' },
      body: JSON.stringify({ name: 'Ana', email: 'ana@x.com', password: 'senha-segura-1' }),
    });

    expect(statuses).toEqual(Array(10).fill(200));
    expect(blocked.status).toBe(429);
    expect(signup.status).toBe(202);
  });

  test('sign-up attempts do not consume the invitation limiter', async () => {
    const app = await makeApp({ email: new InMemoryEmailSender() });
    const token = await invite(app);

    for (let i = 0; i < 10; i += 1) {
      await app.request('/auth/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '6.6.6.6' },
        body: JSON.stringify({ email: `x${i}@x.com` }),
      });
    }

    expect((await preview(app, token, '6.6.6.6')).status).toBe(200);
  });

  test('with e-mail off, a link-only invite answers 503 and creates no account', async () => {
    const app = await makeApp({ email: new DisabledEmailSender() });
    const token = await whatsappInvite(app);

    const res = await accept(app, token, { ...newAccount, email: 'nova@x.com' });

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'Envio de e-mail indisponível' });
    expect(await count("users WHERE email = 'nova@x.com'")).toBe(0);
    expect(await count("invitations WHERE status = 'pendente' AND claimed_by IS NULL")).toBe(1);
  });

  test('with e-mail off, an unconfirmed account cannot claim a link-only invite', async () => {
    const app = await makeApp({ email: new DisabledEmailSender() });
    await insertEmailUser('ana@x.com', 'senha-da-ana');
    const token = await whatsappInvite(app);

    const res = await accept(app, token, {
      email: 'ana@x.com',
      password: 'senha-da-ana',
      name: 'Ana',
    });

    expect(res.status).toBe(503);
    expect(await count("invitations WHERE status = 'pendente' AND claimed_by IS NULL")).toBe(1);
  });

  test('with e-mail off, a verified account still accepts a link-only invite', async () => {
    const app = await makeApp({ email: new DisabledEmailSender() });
    await insertEmailUser('ana@x.com', 'senha-da-ana');
    await pool.query("UPDATE users SET email_verified_at = now() WHERE email = 'ana@x.com'");
    const token = await whatsappInvite(app);

    const res = await accept(app, token, {
      email: 'ana@x.com',
      password: 'senha-da-ana',
      name: 'Ana',
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      condos: [CONDO],
      emailVerified: true,
      invitedCondoId: CONDO.id,
    });
  });
});

const PIX_INPUT = {
  keyType: 'cpf',
  key: '123.456.789-09',
  receiverName: 'Condomínio Morada',
  city: 'Santos',
};

describe('Síndico access', () => {
  const sindicoCredentials = { username: 'sindico', password: 'senha-sindico-1' };
  const SINDICO_RESIDENT_ID = 'r-3';

  async function sindicoApp() {
    const app = await makeApp();
    const hasher = new BcryptPasswordHasher(config.bcryptCost);
    await new PostgresUserRepository(pool).save({
      id: 'u-sindico',
      username: sindicoCredentials.username,
      email: null,
      name: 'Síndica Teste',
      passwordHash: await hasher.hash(sindicoCredentials.password),
      role: 'resident',
      residentId: null,
      emailVerifiedAt: null,
      sessionVersion: 0,
    });
    await pool.query(
      `INSERT INTO condo_roles (id, condominium_id, user_id, role, resident_id) VALUES
         ('role-sindico', $1, 'u-sindico', 'sindico', NULL),
         ('role-sindico-home', $1, 'u-sindico', 'morador', $2)`,
      [TEST_CONDO_ID, SINDICO_RESIDENT_ID],
    );
    const sindico = await authFor(app, sindicoCredentials);
    const request = (path: string, init: RequestInit = {}) =>
      app.request(path, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          Cookie: sindico.cookie,
          'X-CSRF-Token': sindico.csrf,
        },
      });
    return { app, request };
  }

  const json = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  test('sindico cannot complete onboarding', async () => {
    const { request } = await sindicoApp();

    const res = await request(`${P}/onboarding/complete`, { method: 'POST' });

    expect(res.status).toBe(403);
  });

  test('sindico cannot manage fees or condo', async () => {
    const { request } = await sindicoApp();

    const settings = await request(`${P}/settings`, json('PUT', { monthlyFeeCents: 1, dueDay: 5 }));
    const info = await request(`${P}/info`, json('PUT', { name: 'Outro nome' }));
    const residents = await request(`${P}/residents`);
    const account = await request(
      `${P}/accounts`,
      json('POST', {
        description: 'Água',
        category: 'Utilidades',
        valueCents: 1000,
        date: '2026-04-05',
        status: 'pendente',
      }),
    );
    const notice = await request(
      `${P}/notices`,
      json('POST', { title: 'Aviso', body: 'Corpo', kind: 'aviso', audience: 'Todos' }),
    );

    expect(settings.status).toBe(403);
    expect(await settings.json()).toEqual({ error: 'Acesso negado' });
    expect(info.status).toBe(403);
    expect(residents.status).toBe(200);
    expect(account.status).toBe(201);
    expect(notice.status).toBe(201);
  });

  test('sindico cannot change pix', async () => {
    const { request } = await sindicoApp();

    const res = await request(
      `${P}/settings`,
      json('PUT', { monthlyFeeCents: 15000, dueDay: 15, pix: PIX_INPUT }),
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Acesso negado' });
  });

  test('resident reads pix', async () => {
    const { app, request } = await sindicoApp();
    await pool.query(
      `UPDATE condo_settings SET pix_key_type = 'cpf', pix_key = '12345678909',
         pix_receiver_name = 'Condomínio Morada', pix_city = 'Santos'
       WHERE condominium_id = $1`,
      [TEST_CONDO_ID],
    );
    const resident = await authFor(app, residentCredentials);

    const asResident = await app.request(`${P}/pix`, {
      headers: { Cookie: resident.cookie, 'X-CSRF-Token': resident.csrf },
    });
    const asSindicoResidentView = await request(`${P}/pix`, {
      headers: { 'X-Morada-View': 'resident' },
    });

    const expected = {
      configured: true,
      key: '12345678909',
      receiverName: 'Condomínio Morada',
      city: 'Santos',
    };
    expect(asResident.status).toBe(200);
    expect(await asResident.json()).toEqual(expected);
    expect(asSindicoResidentView.status).toBe(200);
    expect(await asSindicoResidentView.json()).toEqual(expected);
  });

  test('the administrador configures pix and the update without pix keeps it', async () => {
    const app = await makeApp();
    const admin = await authFor(app, adminCredentials);
    const headers = {
      Cookie: admin.cookie,
      'X-CSRF-Token': admin.csrf,
      'Content-Type': 'application/json',
    };
    const put = (body: unknown) =>
      app.request(`${P}/settings`, { method: 'PUT', headers, body: JSON.stringify(body) });

    const before = await app.request(`${P}/pix`, { headers });
    await put({ monthlyFeeCents: 15000, dueDay: 15, pix: PIX_INPUT });
    await put({ monthlyFeeCents: 16000, dueDay: 12 });
    const kept = await app.request(`${P}/pix`, { headers });
    await put({ monthlyFeeCents: 16000, dueDay: 12, pix: null, openingBalance: null });
    const cleared = await app.request(`${P}/pix`, { headers });

    expect(await before.json()).toEqual({ configured: false });
    expect(await kept.json()).toEqual({
      configured: true,
      key: '12345678909',
      receiverName: 'Condomínio Morada',
      city: 'Santos',
    });
    expect(await cleared.json()).toEqual({ configured: false });
  });

  test('the administrador still manages fees', async () => {
    const app = await makeApp();
    const admin = await authFor(app, adminCredentials);

    const settings = await app.request(`${P}/settings`, {
      method: 'PUT',
      headers: {
        Cookie: admin.cookie,
        'X-CSRF-Token': admin.csrf,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ monthlyFeeCents: 1, dueDay: 5 }),
    });

    expect(settings.status).toBe(200);
  });

  test('/me/condos lists the sindico with a home and four permissions', async () => {
    const { request } = await sindicoApp();

    const res = await request('/me/condos');

    expect(await res.json()).toEqual([
      {
        id: TEST_CONDO_ID,
        name: `Condomínio ${TEST_CONDO_ID}`,
        role: 'admin',
        condoRole: 'sindico',
        permissions: ['view_building', 'publish_notices', 'manage_residents', 'manage_money'],
        hasHome: true,
        organizationId: `org-${TEST_CONDO_ID}`,
        orgRole: null,
        onboardingPending: false,
      },
    ]);
  });

  test('view header', async () => {
    const { request } = await sindicoApp();

    const home = await request(`${P}/receipts`, { headers: { 'X-Morada-View': 'resident' } });
    const building = await request(`${P}/receipts`);

    expect(home.status).toBe(200);
    const homeReceipts = (await home.json()) as { residentId: string }[];
    expect(homeReceipts.length).toBeGreaterThan(0);
    expect(homeReceipts.every((r) => r.residentId === SINDICO_RESIDENT_ID)).toBe(true);
    const buildingReceipts = (await building.json()) as { residentId: string }[];
    expect(buildingReceipts.some((r) => r.residentId !== SINDICO_RESIDENT_ID)).toBe(true);
  });

  test('the resident view drops staff routes even for the sindico', async () => {
    const { request } = await sindicoApp();

    const res = await request(`${P}/accounts`, { headers: { 'X-Morada-View': 'resident' } });

    expect(res.status).toBe(403);
  });

  test('CORS allows the view header', async () => {
    const origin = config.webOrigins[0] ?? '';
    const res = await (
      await makeApp()
    ).request(`${P}/receipts`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'X-Morada-View',
      },
    });

    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('X-Morada-View');
  });

  describe('síndico management', () => {
    const S = `${P}/sindico`;
    const SINDICA = 'nova.sindica@x.com';

    async function adminRequest(app: App) {
      const admin = await authFor(app, adminCredentials);
      return (path: string, init: RequestInit = {}) =>
        app.request(path, {
          ...init,
          headers: {
            ...(init.headers ?? {}),
            Cookie: admin.cookie,
            'X-CSRF-Token': admin.csrf,
          },
        });
    }

    function tokenOf(link: string): string {
      return link.slice(`${config.appUrl}/#/convite/`.length);
    }

    function publicRequest(app: App, path: string, body?: unknown) {
      return app.request(`/auth/invitations/${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '7.7.7.7' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    }

    async function inviteSindico(app: App): Promise<string> {
      const admin = await adminRequest(app);
      const res = await admin(`${S}/invitation`, json('POST', { email: SINDICA }));
      expect(res.status).toBe(201);
      return tokenOf(((await res.json()) as { link: string }).link);
    }

    const newSindica = { password: 'senha-sindica-1', name: 'Nova Síndica' };

    test('sindico routes are administrador-only', async () => {
      const { request } = await sindicoApp();

      const invite = await request(`${S}/invitation`, json('POST', { email: SINDICA }));
      const view = await request(S);
      const revoke = await request(`${S}/invitation/revoke`, { method: 'POST' });
      const remove = await request(`${S}/remove`, { method: 'POST' });

      expect(invite.status).toBe(403);
      expect(await invite.json()).toEqual({ error: 'Acesso negado' });
      expect([view.status, revoke.status, remove.status]).toEqual([403, 403, 403]);
      expect(await count('invitations')).toBe(0);
      expect(await count("condo_roles WHERE role = 'sindico' AND active")).toBe(1);
    });

    test('an administrador invites a sindico who accepts and becomes the current sindico', async () => {
      const sender = new InMemoryEmailSender();
      const app = await makeApp({ email: sender });
      const admin = await adminRequest(app);

      const created = await admin(
        `${S}/invitation`,
        json('POST', { email: ` ${SINDICA.toUpperCase()} `, phone: '(11) 98888-7777' }),
      );

      expect(created.status).toBe(201);
      const body = (await created.json()) as Record<string, unknown> & { link: string };
      expect(body).toMatchObject({ status: 'pendente', email: SINDICA, emailSent: true });
      expect(body.whatsappUrl).toMatch(/^https:\/\/wa\.me\/5511988887777\?text=/);
      expect(sender.lastTo(SINDICA)?.subject).toBe(
        `Você foi convidado para ser síndico do Condomínio ${TEST_CONDO_ID}`,
      );
      const pending = (await (await admin(S)).json()) as Record<string, unknown>;
      expect(pending).toEqual({
        current: null,
        invitation: { status: 'pendente', email: SINDICA, expiresAt: body.expiresAt },
      });
      const token = tokenOf(body.link);
      expect(await (await publicRequest(app, token)).json()).toEqual({
        role: 'sindico',
        targetName: `Condomínio ${TEST_CONDO_ID}`,
        condoName: `Condomínio ${TEST_CONDO_ID}`,
        email: SINDICA,
        accountExists: false,
      });

      const accepted = await publicRequest(app, `${token}/accept`, newSindica);

      expect(accepted.status).toBe(200);
      const session = (await accepted.json()) as {
        condos: Record<string, unknown>[];
        invitedCondoId: string | null;
      };
      expect(session.condos).toEqual([
        expect.objectContaining({ id: TEST_CONDO_ID, role: 'admin', condoRole: 'sindico' }),
      ]);
      expect(session.invitedCondoId).toBe(TEST_CONDO_ID);
      expect(await (await admin(S)).json()).toEqual({
        current: { name: 'Nova Síndica', email: SINDICA },
        invitation: { status: 'aceito', email: SINDICA, expiresAt: body.expiresAt },
      });
    });

    test('accepting a sindico invite retires the previous sindico', async () => {
      const { app, request } = await sindicoApp();
      const token = await inviteSindico(app);

      await publicRequest(app, `${token}/accept`, newSindica);

      expect(await count("condo_roles WHERE role = 'sindico' AND active")).toBe(1);
      expect(await count("condo_roles WHERE user_id = 'u-sindico' AND role = 'sindico'")).toBe(1);
      const me = (await (await request('/me/condos')).json()) as { condoRole: string }[];
      expect(me.map((c) => c.condoRole)).toEqual(['morador']);
    });

    test('a sindico invite accepted with another e-mail is 401 and grants nothing', async () => {
      const app = await makeApp({ email: new InMemoryEmailSender() });
      const token = await inviteSindico(app);

      const res = await publicRequest(app, `${token}/accept`, {
        ...newSindica,
        email: 'intrusa@x.com',
      });

      expect(res.status).toBe(401);
      expect(await count(`users WHERE email IN ('intrusa@x.com', '${SINDICA}')`)).toBe(0);
      expect(await count("invitations WHERE status = 'pendente' AND claimed_by IS NULL")).toBe(1);
      expect(await count("condo_roles WHERE role = 'sindico'")).toBe(0);
    });

    test('a sindico invite created in one condominium grants nothing in another', async () => {
      const app = await makeApp({ email: new InMemoryEmailSender() });
      await createTestCondo(pool, 'condo-b', { orgId: `org-${TEST_CONDO_ID}` });
      const admin = await adminRequest(app);
      const token = await inviteSindico(app);

      const accepted = await publicRequest(app, `${token}/accept`, newSindica);

      const { condos } = (await accepted.json()) as { condos: { id: string }[] };
      expect(condos.map((c) => c.id)).toEqual([TEST_CONDO_ID]);
      expect(await (await admin('/api/condos/condo-b/sindico')).json()).toEqual({
        current: null,
        invitation: null,
      });
    });

    test('reenviar and revoke leave the old links invalid', async () => {
      const app = await makeApp({ email: new InMemoryEmailSender() });
      const admin = await adminRequest(app);
      const first = await inviteSindico(app);
      const second = await inviteSindico(app);

      const revoked = await admin(`${S}/invitation/revoke`, { method: 'POST' });

      expect(revoked.status).toBe(204);
      for (const token of [first, second]) {
        const res = await publicRequest(app, token);
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: 'Convite inválido ou expirado' });
      }
      expect(((await (await admin(S)).json()) as { invitation: unknown }).invitation).toMatchObject(
        { status: 'revogado' },
      );
    });

    test('creating a sindico invite without an e-mail is 400', async () => {
      const app = await makeApp();
      const admin = await adminRequest(app);

      const res = await admin(`${S}/invitation`, json('POST', { phone: '(11) 98888-7777' }));

      expect(res.status).toBe(400);
      expect(await count('invitations')).toBe(0);
    });

    test('remove deactivates the sindico grant', async () => {
      const { app, request } = await sindicoApp();
      const admin = await adminRequest(app);

      const removed = await admin(`${S}/remove`, { method: 'POST' });

      expect(removed.status).toBe(204);
      expect(await (await admin(S)).json()).toEqual({ current: null, invitation: null });
      expect((await request(`${P}/dashboard`)).status).toBe(200);
      expect((await request(`${P}/accounts`)).status).toBe(403);
      await pool.query("UPDATE condo_roles SET active = FALSE WHERE id = 'role-sindico-home'");
      expect((await request(`${P}/dashboard`)).status).toBe(404);
      expect(await count("condo_roles WHERE id = 'role-sindico'")).toBe(1);
    });
  });

  describe('activity log', () => {
    const accountBody = {
      description: 'Água',
      category: 'Utilidades',
      valueCents: 1000,
      date: '2026-04-05',
      status: 'pendente',
    };

    async function adminActivity(app: App) {
      const admin = await authFor(app, adminCredentials);
      return app.request(`${P}/activity`, {
        headers: { Cookie: admin.cookie, 'X-CSRF-Token': admin.csrf },
      });
    }

    test("a síndico's account creation is logged with the síndico as actor", async () => {
      const { app, request } = await sindicoApp();

      await request(`${P}/accounts`, json('POST', accountBody));
      const res = await adminActivity(app);

      const body = (await res.json()) as Record<string, unknown>[];
      expect(res.status).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        action: 'account.created',
        label: 'Conta lançada',
        actorName: 'Síndica Teste',
      });
    });

    test('failed writes are not logged', async () => {
      const { app, request } = await sindicoApp();

      const bad = await request(`${P}/accounts`, json('POST', { description: '' }));
      const res = await adminActivity(app);

      expect(bad.status).toBe(400);
      expect(await res.json()).toEqual([]);
    });

    test('sindico cannot read the activity', async () => {
      const { request } = await sindicoApp();

      const res = await request(`${P}/activity`);

      expect(res.status).toBe(403);
    });

    test('a no-op ensure-month adds no row and one that creates receipts adds exactly one', async () => {
      const app = await makeApp();
      const admin = await authFor(app, adminCredentials);
      const headers = { Cookie: admin.cookie, 'X-CSRF-Token': admin.csrf };
      const ensure = () => app.request(`${P}/receipts/ensure-month`, { method: 'POST', headers });

      const first = (await (await ensure()).json()) as unknown[];
      await ensure();
      const res = await app.request(`${P}/activity`, { headers });

      const body = (await res.json()) as { action: string }[];
      expect(first.length).toBeGreaterThan(0);
      expect(body.map((e) => e.action)).toEqual(['receipt.monthly']);
    });

    test('a :id route records the resource id as subjectId', async () => {
      const { app, request } = await sindicoApp();
      const created = (await (
        await request(`${P}/accounts`, json('POST', accountBody))
      ).json()) as { id: string };

      await request(`${P}/accounts/${created.id}`, json('PUT', accountBody));
      const res = await adminActivity(app);

      const body = (await res.json()) as { action: string; subjectId: string | null }[];
      expect(body.find((e) => e.action === 'account.updated')?.subjectId).toBe(created.id);
    });

    test('every money write has an activity label', async () => {
      const app = await makeApp();
      const prefixes = ['accounts', 'incomes', 'categories', 'receipts'].map(
        (name) => `${P.replace(TEST_CONDO_ID, ':condoId')}/${name}`,
      );
      const statusPath = `${P.replace(TEST_CONDO_ID, ':condoId')}/residents/:id/status`;

      const writes = app.routes.filter(
        (r) =>
          r.method !== 'GET' &&
          r.method !== 'ALL' &&
          (r.path === statusPath ||
            prefixes.some((p) => r.path === p || r.path.startsWith(`${p}/`))),
      );

      expect(writes.length).toBeGreaterThan(10);
      for (const route of writes) {
        expect([
          route.method,
          route.path,
          moneyActivityResolver(route.method, route.path),
        ]).not.toContain(null);
      }
    });
  });
});

describe('Organization team', () => {
  const ORG_ID = `org-${TEST_CONDO_ID}`;
  const O = `/api/orgs/${ORG_ID}`;
  const memberCredentials = { username: 'equipe', password: 'senha-equipe-1' };

  const json = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  async function saveUser(id: string, username: string, password: string, name: string) {
    const hasher = new BcryptPasswordHasher(config.bcryptCost);
    await new PostgresUserRepository(pool).save({
      id,
      username,
      email: `${username}@equipe.test`,
      name,
      passwordHash: await hasher.hash(password),
      role: 'resident',
      residentId: null,
      emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      sessionVersion: 0,
    });
  }

  function requester(app: App, auth: Auth) {
    return (path: string, init: RequestInit = {}) =>
      app.request(path, {
        ...init,
        headers: { ...(init.headers ?? {}), Cookie: auth.cookie, 'X-CSRF-Token': auth.csrf },
      });
  }

  async function teamApp(opts?: { email?: EmailSender }) {
    const app = await makeApp(opts);
    await saveUser('u-equipe', memberCredentials.username, memberCredentials.password, 'Equipe');
    await pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role)
       VALUES ('om-equipe', $1, 'u-equipe', 'member')`,
      [ORG_ID],
    );
    await createTestCondo(pool, 'condo-b', { orgId: ORG_ID, name: 'Bloco B' });
    await createTestCondo(pool, 'condo-x', { orgId: 'org-x', name: 'Alheio' });
    const owner = requester(app, await authFor(app, adminCredentials));
    const member = requester(app, await authFor(app, memberCredentials));
    const outsider = requester(app, await authFor(app, residentCredentials));
    return { app, owner, member, outsider };
  }

  async function adminCondosOf(userId: string): Promise<string[]> {
    const { rows } = await pool.query<{ condominium_id: string }>(
      `SELECT condominium_id FROM condo_roles
       WHERE user_id = $1 AND role = 'administrador' AND active ORDER BY condominium_id`,
      [userId],
    );
    return rows.map((row) => row.condominium_id);
  }

  test('non-owner gets 404 on org routes', async () => {
    const { member, outsider } = await teamApp();

    for (const request of [member, outsider]) {
      const read = await request(O);
      const rename = await request(O, json('PUT', { name: 'Tomada' }));
      const assign = await request(
        `${O}/members/u-equipe/condos`,
        json('PUT', { condoIds: [TEST_CONDO_ID] }),
      );
      const invite = await request(
        `${O}/invitations`,
        json('POST', { email: 'x@x.com', orgRole: 'owner' }),
      );

      expect(read.status).toBe(404);
      expect(await read.json()).toEqual({ error: 'Organização não encontrada' });
      expect([rename.status, assign.status, invite.status]).toEqual([404, 404, 404]);
    }
    expect(await count(`organizations WHERE name = 'Tomada'`)).toBe(0);
    expect(await count('invitations')).toBe(0);
    expect(await adminCondosOf('u-equipe')).toEqual([]);
  });

  test('an owner of another organization gets 404', async () => {
    const { app } = await teamApp();
    await saveUser('u-alheio', 'alheio', 'senha-alheio-1', 'Alheio');
    await pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role)
       VALUES ('om-alheio', 'org-x', 'u-alheio', 'owner')`,
    );
    const foreign = requester(
      app,
      await authFor(app, { username: 'alheio', password: 'senha-alheio-1' }),
    );

    expect((await foreign(O)).status).toBe(404);
    expect((await foreign('/api/orgs/org-x')).status).toBe(200);
  });

  test('the owner reads the team, the condos and the pending invitations', async () => {
    const { owner } = await teamApp({ email: new InMemoryEmailSender() });
    await pool.query("UPDATE condominiums SET active = FALSE WHERE id = 'condo-b'");
    const invited = await owner(
      `${O}/invitations`,
      json('POST', { email: 'nova@x.com', orgRole: 'member' }),
    );
    const { expiresAt } = (await invited.json()) as { expiresAt: string };

    const res = await owner(O);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { invitations: { id: string }[] };
    expect(body).toEqual({
      id: ORG_ID,
      name: `Organização ${ORG_ID}`,
      members: [
        expect.objectContaining({ userId: 'u-admin', role: 'owner', active: true }),
        {
          userId: 'u-equipe',
          name: 'Equipe',
          email: 'equipe@equipe.test',
          role: 'member',
          active: true,
          condoIds: [],
        },
      ],
      condos: [{ id: TEST_CONDO_ID, name: `Condomínio ${TEST_CONDO_ID}` }],
      invitations: [{ id: expect.any(String), email: 'nova@x.com', orgRole: 'member', expiresAt }],
    });
  });

  test('the owner renames the organization', async () => {
    const { owner } = await teamApp();

    const renamed = await owner(O, json('PUT', { name: '  Gestora Ipê ' }));
    const blank = await owner(O, json('PUT', { name: '   ' }));

    expect(renamed.status).toBe(200);
    expect(await renamed.json()).toEqual({ id: ORG_ID, name: 'Gestora Ipê' });
    expect(blank.status).toBe(400);
  });

  test('an owner invites a member who accepts and joins the team', async () => {
    const sender = new InMemoryEmailSender();
    const { app, owner } = await teamApp({ email: sender });

    const first = await owner(
      `${O}/invitations`,
      json('POST', { email: 'Nova@x.com', orgRole: 'member', phone: '(11) 98888-7777' }),
    );
    const second = await owner(
      `${O}/invitations`,
      json('POST', { email: 'nova@x.com', orgRole: 'member' }),
    );

    expect(first.status).toBe(201);
    const created = (await second.json()) as Record<string, unknown> & { link: string };
    expect(created).toMatchObject({ status: 'pendente', email: 'nova@x.com', emailSent: true });
    expect(sender.lastTo('nova@x.com')?.subject).toBe(
      `Você foi convidado para a equipe Organização ${ORG_ID}`,
    );
    expect(await count("invitations WHERE status = 'pendente'")).toBe(1);
    const token = created.link.slice(`${config.appUrl}/#/convite/`.length);
    const accepted = await app.request(`/auth/invitations/${token}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '7.7.7.8' },
      body: JSON.stringify({ password: 'senha-nova-1', name: 'Nova' }),
    });

    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({ invitedCondoId: null });
    const team = (await (await owner(O)).json()) as { members: { name: string }[] };
    expect(team.members.map((m) => m.name)).toContain('Nova');
  });

  test('the owner revokes a pending invitation once', async () => {
    const { owner } = await teamApp({ email: new InMemoryEmailSender() });
    await owner(`${O}/invitations`, json('POST', { email: 'nova@x.com', orgRole: 'member' }));
    const { invitations } = (await (await owner(O)).json()) as { invitations: { id: string }[] };
    const id = invitations[0]?.id ?? '';

    const revoked = await owner(`${O}/invitations/${id}/revoke`, { method: 'POST' });
    const again = await owner(`${O}/invitations/${id}/revoke`, { method: 'POST' });

    expect(revoked.status).toBe(204);
    expect(again.status).toBe(404);
    expect(await count("invitations WHERE status = 'revogado'")).toBe(1);
  });

  test('assign condos makes the member administrador of exactly those condos', async () => {
    const { owner, member } = await teamApp();

    const first = await owner(
      `${O}/members/u-equipe/condos`,
      json('PUT', { condoIds: ['condo-b', TEST_CONDO_ID] }),
    );
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ condoIds: ['condo-b', TEST_CONDO_ID] });

    const second = await owner(
      `${O}/members/u-equipe/condos`,
      json('PUT', { condoIds: ['condo-b'] }),
    );

    expect(await second.json()).toEqual({ condoIds: ['condo-b'] });
    expect(await adminCondosOf('u-equipe')).toEqual(['condo-b']);
    const mine = (await (await member('/me/condos')).json()) as Record<string, unknown>[];
    expect(mine).toEqual([
      expect.objectContaining({ id: 'condo-b', condoRole: 'administrador', orgRole: 'member' }),
    ]);
    expect((await member(`${P}/dashboard`)).status).toBe(404);
    expect((await member('/api/condos/condo-b/dashboard')).status).toBe(200);
  });

  test('assign condos outside the organization is 404 and writes nothing', async () => {
    const { owner } = await teamApp();
    await owner(`${O}/members/u-equipe/condos`, json('PUT', { condoIds: [TEST_CONDO_ID] }));

    const res = await owner(
      `${O}/members/u-equipe/condos`,
      json('PUT', { condoIds: ['condo-b', 'condo-x'] }),
    );

    expect(res.status).toBe(404);
    expect(await adminCondosOf('u-equipe')).toEqual([TEST_CONDO_ID]);
    expect(await count("condo_roles WHERE condominium_id = 'condo-x'")).toBe(0);
  });

  test('assign condos to an owner is 409 and to an outsider is 404', async () => {
    const { owner } = await teamApp();

    const toOwner = await owner(
      `${O}/members/u-admin/condos`,
      json('PUT', { condoIds: ['condo-b'] }),
    );
    const toOutsider = await owner(
      `${O}/members/u-maria/condos`,
      json('PUT', { condoIds: ['condo-b'] }),
    );

    expect(toOwner.status).toBe(409);
    expect(toOutsider.status).toBe(404);
    expect(await count("condo_roles WHERE condominium_id = 'condo-b'")).toBe(0);
  });

  test('deactivated member loses access immediately', async () => {
    const { owner, member } = await teamApp();
    await pool.query(
      `INSERT INTO apartments (id, label, condominium_id) VALUES ('apt-x', 'Apto 1', 'condo-x');
       INSERT INTO residents (id, name, phone, email, status, condominium_id)
         VALUES ('r-x', 'Equipe', '', '', 'em_dia', 'condo-x');
       INSERT INTO apartment_residents (id, apartment_id, resident_id, active)
         VALUES ('occ-x', 'apt-x', 'r-x', TRUE);
       INSERT INTO condo_roles (id, condominium_id, user_id, role, resident_id)
         VALUES ('role-x', 'condo-x', 'u-equipe', 'morador', 'r-x');`,
    );
    await owner(`${O}/members/u-equipe/condos`, json('PUT', { condoIds: ['condo-b'] }));
    expect((await member('/api/condos/condo-b/dashboard')).status).toBe(200);

    const res = await owner(`${O}/members/u-equipe/deactivate`, { method: 'POST' });

    expect(res.status).toBe(204);
    expect((await member('/api/condos/condo-b/dashboard')).status).toBe(404);
    expect((await member('/api/condos/condo-x/dashboard')).status).toBe(200);
    const team = (await (await owner(O)).json()) as { members: Record<string, unknown>[] };
    expect(team.members).toContainEqual(
      expect.objectContaining({ userId: 'u-equipe', active: false, condoIds: [] }),
    );
  });

  test('owner cannot deactivate an owner or themselves', async () => {
    const { owner } = await teamApp();
    await saveUser('u-socio', 'socio', 'senha-socio-1', 'Sócio');
    await pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role)
       VALUES ('om-socio', $1, 'u-socio', 'owner')`,
      [ORG_ID],
    );

    const other = await owner(`${O}/members/u-socio/deactivate`, { method: 'POST' });
    const self = await owner(`${O}/members/u-admin/deactivate`, { method: 'POST' });

    expect(other.status).toBe(409);
    expect(await other.json()).toEqual({ error: 'Não é possível desativar um dono' });
    expect(self.status).toBe(409);
    expect(await self.json()).toEqual({ error: 'Você não pode se desativar' });
    expect(await count('organization_members WHERE active')).toBe(3);
  });

  test('member creating a condo gets it in their organization', async () => {
    const { member } = await teamApp();

    const res = await member('/me/condos', json('POST', { name: 'Residencial Equipe' }));

    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: string; organizationId: string };
    expect(created.organizationId).toBe(ORG_ID);
    expect(await count('organizations')).toBe(2);
    const mine = (await (await member('/me/condos')).json()) as Record<string, unknown>[];
    expect(mine).toEqual([
      expect.objectContaining({
        id: created.id,
        condoRole: 'administrador',
        organizationId: ORG_ID,
        orgRole: 'member',
      }),
    ]);
  });
});

describe('Building view and apartment management', () => {
  const jsonBody = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  async function adminRequest(app: App) {
    const auth = await authFor(app, adminCredentials);
    return (path: string, init: RequestInit = {}) =>
      app.request(path, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          Cookie: auth.cookie,
          'X-CSRF-Token': auth.csrf,
        },
      });
  }

  test('GET building draws the seeded apartments with their occupants', async () => {
    const app = await makeApp();
    const request = await adminRequest(app);

    const res = await request(`${P}/building`);
    const body = (await res.json()) as {
      blocks: { name: string | null; floors: { floor: number }[] }[];
      unplaced: unknown[];
    };

    expect(res.status).toBe(200);
    const floors = body.blocks.flatMap((b) => b.floors.map((f) => f.floor));
    expect(floors).toEqual([...floors].sort((a, b) => b - a));
    expect(JSON.stringify(body)).toContain('Maria Ribeiro');
  });

  test('GET building colours windows by the derived status and the admin override', async () => {
    const app = await makeApp();
    const repos = makePostgresRepositories(pool).forCondo(TEST_CONDO_ID);
    await repos.receipts.save({
      id: 'rc-future',
      ref: '12/2099',
      title: 'Taxa condominial',
      dueDate: '2099-12-10',
      valueCents: 45000,
      status: 'pendente',
      residentId: 'r-2',
      apartmentId: 'apt-r-2',
    });
    await repos.residents.setStatusOverride('r-4', 'atrasado');
    const request = await adminRequest(app);

    const res = await request(`${P}/building`);
    type Window = { residentId: string | null; state: string };
    const body = (await res.json()) as {
      blocks: { floors: { apartments: Window[] }[] }[];
      unplaced: Window[];
    };
    const stateOf = (residentId: string) =>
      [...body.blocks.flatMap((b) => b.floors.flatMap((f) => f.apartments)), ...body.unplaced].find(
        (a) => a.residentId === residentId,
      )?.state;

    expect(stateOf('r-1')).toBe('atrasado');
    expect(stateOf('r-2')).toBe('pendente');
    expect(stateOf('r-5')).toBe('ocupado');
    expect(stateOf('r-4')).toBe('atrasado');
  });

  test('administrador adds, renames and deactivates an apartment', async () => {
    const app = await makeApp();
    const request = await adminRequest(app);

    const created = await request(
      `${P}/building/apartments`,
      jsonBody('POST', { label: 'Apto 801', block: null, floor: 8 }),
    );
    const apartment = (await created.json()) as { id: string; label: string };
    const renamed = await request(
      `${P}/building/apartments/${apartment.id}`,
      jsonBody('PUT', { label: 'Cobertura' }),
    );
    const duplicate = await request(
      `${P}/building/apartments`,
      jsonBody('POST', { label: 'Cobertura', block: null, floor: 8 }),
    );
    const invalid = await request(
      `${P}/building/apartments`,
      jsonBody('POST', { label: '', block: null, floor: 8 }),
    );
    const deactivated = await request(`${P}/building/apartments/${apartment.id}/deactivate`, {
      method: 'POST',
    });

    expect(created.status).toBe(201);
    expect(renamed.status).toBe(200);
    expect(((await renamed.json()) as { label: string }).label).toBe('Cobertura');
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toEqual({ error: 'Já existe um apartamento com esse nome' });
    expect(invalid.status).toBe(400);
    expect(deactivated.status).toBe(204);
  });

  test('deactivating an apartment with an active resident answers 409', async () => {
    const app = await makeApp();
    const request = await adminRequest(app);
    const resident = await makePostgresRepositories(pool)
      .forCondo(TEST_CONDO_ID)
      .residents.getById('r-1');

    const res = await request(`${P}/building/apartments/${resident?.apartmentId}/deactivate`, {
      method: 'POST',
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Apartamento com morador ativo' });
  });

  test('GET building isolates condos', async () => {
    const app = await makeApp();
    await createTestCondo(pool, 'condo-other');
    const foreign = await makePostgresRepositories(pool)
      .forCondo('condo-other')
      .building.add({ label: 'Apto 900', block: null, floor: 9 });
    const request = await adminRequest(app);

    const rename = await request(
      `${P}/building/apartments/${foreign.id}`,
      jsonBody('PUT', { label: 'Invadido' }),
    );
    const deactivate = await request(`${P}/building/apartments/${foreign.id}/deactivate`, {
      method: 'POST',
    });
    const list = await request(`${P}/building`);

    expect(rename.status).toBe(404);
    expect(await rename.json()).toEqual({ error: 'Apartamento não encontrado' });
    expect(deactivate.status).toBe(404);
    expect(JSON.stringify(await list.json())).not.toContain('Apto 900');
  });

  test('sindico sees the building but cannot change it', async () => {
    const app = await makeApp();
    const hasher = new BcryptPasswordHasher(config.bcryptCost);
    await new PostgresUserRepository(pool).save({
      id: 'u-sindico-b',
      username: 'sindico-b',
      email: null,
      name: 'Síndica',
      passwordHash: await hasher.hash('senha-sindico-1'),
      role: 'resident',
      residentId: null,
      emailVerifiedAt: null,
      sessionVersion: 0,
    });
    await pool.query(
      `INSERT INTO condo_roles (id, condominium_id, user_id, role, resident_id)
       VALUES ('role-sindico-b', $1, 'u-sindico-b', 'sindico', NULL)`,
      [TEST_CONDO_ID],
    );
    const auth = await authFor(app, { username: 'sindico-b', password: 'senha-sindico-1' });
    const headers = { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrf };

    const read = await app.request(`${P}/building`, { headers });
    const create = await app.request(`${P}/building/apartments`, {
      ...jsonBody('POST', { label: 'Apto 901', block: null, floor: 9 }),
      headers: { ...headers, 'Content-Type': 'application/json' },
    });

    expect(read.status).toBe(200);
    expect(create.status).toBe(403);
    expect(await create.json()).toEqual({ error: 'Acesso negado' });
  });

  test('a resident cannot read the building', async () => {
    const app = await makeApp();
    const auth = await authFor(app, residentCredentials);

    const res = await app.request(`${P}/building`, {
      headers: { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrf },
    });

    expect(res.status).toBe(403);
  });
});
