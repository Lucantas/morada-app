import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';

import { accountRoutes } from './accounts/adapters/http/routes';
import { categoryRoutes } from './categories/adapters/http/routes';
import { dashboardRoutes } from './dashboard/adapters/http/routes';
import { incomeRoutes } from './income/adapters/http/routes';
import { threadRoutes } from './messages/adapters/http/routes';
import { noticeRoutes } from './notices/adapters/http/routes';
import { authMiddleware, requireRole, signSession, type ApiEnv, type Role } from './platform/auth';
import { config } from './platform/config';
import { createRepositories, type Repositories } from './repositories';
import { onError } from './platform/http-error';
import { receiptRoutes } from './receipts/adapters/http/routes';
import { confirmPayment } from './receipts/app/confirm-payment';
import { createReceipt } from './receipts/app/create-receipt';
import { editReceipt } from './receipts/app/edit-receipt';
import { generateMonthlyReceipts } from './receipts/app/generate-monthly-receipts';
import { rejectPayment } from './receipts/app/reject-payment';
import { getResident } from './residents/app/get-resident';
import { residentRoutes } from './residents/adapters/http/routes';
import { seedAdmin } from './seed-data';
import { settingsRoutes } from './settings/adapters/http/routes';
import { generateTempPassword } from './platform/temp-password';
import { createResidentLogin } from './users/app/create-resident-login';
import { verifyCredentials } from './users/app/verify-credentials';
import { BcryptPasswordHasher } from './users/adapters/bcrypt/bcrypt-password-hasher';
import { usernameSchema } from './users/domain/user';

const loginSchema = z.object({
  username: z.string().min(1).max(60),
  password: z.string().min(1).max(200),
});

const provisionSchema = z.object({
  username: usernameSchema,
  residentId: z.string().min(1).max(64),
});

function guarded(role: Role, routes: Hono<ApiEnv>): Hono<ApiEnv> {
  const group = new Hono<ApiEnv>();
  group.use('*', requireRole(role));
  group.route('/', routes);
  return group;
}

export async function buildApp(repos: Repositories): Promise<Hono<ApiEnv>> {
  const {
    residents,
    accounts,
    receipts,
    notices,
    threads,
    dashboard,
    users,
    settings,
    categories,
    incomes,
  } = repos;
  const hasher = new BcryptPasswordHasher(config.bcryptCost);
  // The seeded admin uses a weak, public password — never auto-seed it into a
  // real production database. Opt in explicitly with SEED_DEMO_DATA when needed.
  if (!config.isProduction || process.env.SEED_DEMO_DATA === '1') {
    await seedAdmin(users, hasher);
  }

  const app = new Hono<ApiEnv>();
  app.onError(onError);
  app.use(
    '*',
    cors({
      origin: config.webOrigin,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  app.get('/healthz', (c) => c.json({ status: 'ok' }));

  // Verifies real credentials and issues a JWT whose `sub` is the resident's own
  // id (admins get their user id), so per-resident data stays scoped by subject.
  app.post('/auth/login', async (c) => {
    const { username, password } = loginSchema.parse(await c.req.json());
    const user = await verifyCredentials(users, hasher, username, password);
    const subject = user.role === 'resident' ? (user.residentId ?? user.id) : user.id;
    return c.json({ token: await signSession(user.role, subject), role: user.role });
  });

  const api = new Hono<ApiEnv>();
  api.use('*', authMiddleware);

  // Admin-only: provision a resident login. Returns the generated temp password
  // once for the admin to relay; only the hash is ever stored.
  api.post('/users', requireRole('admin'), async (c) => {
    const { username, residentId } = provisionSchema.parse(await c.req.json());
    const tempPassword = generateTempPassword();
    const user = await createResidentLogin(
      users,
      hasher,
      async (id) => (await residents.getById(id)) !== null,
      {
        username,
        password: tempPassword,
        residentId,
      },
    );
    return c.json(
      { id: user.id, username: user.username, residentId: user.residentId, tempPassword },
      201,
    );
  });

  // A resident reads their own record by their JWT subject (before the
  // admin-only group below, which would otherwise 403 this).
  api.get('/residents/me', async (c) =>
    c.json(await getResident(residents, receipts, c.get('sub'))),
  );

  // Admin-only resources.
  api.route('/residents', guarded('admin', residentRoutes(residents, receipts)));
  api.route('/accounts', guarded('admin', accountRoutes(accounts)));
  api.route('/incomes', guarded('admin', incomeRoutes(incomes)));
  api.route(
    '/categories',
    guarded(
      'admin',
      categoryRoutes(categories, {
        list: () => accounts.list(),
        save: async (account) => {
          const existing = await accounts.getById(account.id);
          if (existing) await accounts.save({ ...existing, category: account.category });
        },
      }),
    ),
  );
  api.route('/settings', guarded('admin', settingsRoutes(settings)));

  // Issuing a charge is admin-only; reads/pay (mounted below) are per-resident.
  api.post('/receipts', requireRole('admin'), async (c) =>
    c.json(
      await createReceipt(receipts, (id) => residents.apartmentOf(id), await c.req.json()),
      201,
    ),
  );

  // Editing a receipt (ref/title/valueCents/dueDate) is admin-only; must be
  // registered before the '/receipts' mount below or it would be shadowed.
  api.put('/receipts/:id', requireRole('admin'), async (c) =>
    c.json(await editReceipt(receipts, c.req.param('id'), await c.req.json())),
  );

  // Admin: confirm or reject a resident's submitted payment (status
  // 'em_analise'); both must be registered before the '/receipts' mount
  // below or they would be shadowed.
  api.post('/receipts/:id/confirm', requireRole('admin'), async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { paidAt?: string };
    const paidAt = body.paidAt ?? new Date().toISOString().slice(0, 10);
    return c.json(await confirmPayment(receipts, c.req.param('id'), paidAt));
  });
  api.post('/receipts/:id/reject', requireRole('admin'), async (c) =>
    c.json(await rejectPayment(receipts, c.req.param('id'))),
  );

  // Admin-only: create the missing monthly condo-fee receipts, idempotently
  // (one 'pendente' charge per active resident for the current ref/month).
  api.post('/receipts/ensure-month', requireRole('admin'), async (c) =>
    c.json(
      await generateMonthlyReceipts(
        receipts,
        residents,
        settings,
        new Date().toISOString().slice(0, 10),
      ),
      201,
    ),
  );

  // Admin: an apartment's full receipt ledger, across every resident who has
  // occupied it (the resident-facing view stays scoped to their own receipts).
  api.get('/apartments/:id/receipts', requireRole('admin'), async (c) =>
    c.json(await receipts.listByApartment(c.req.param('id'))),
  );

  // Admin: an apartment's occupant history — the current resident plus everyone
  // who has moved out (active-first). Powers the "moradores antigos" view.
  api.get('/apartments/:id/residents', requireRole('admin'), async (c) =>
    c.json(await residents.listByApartment(c.req.param('id'))),
  );

  // Any authenticated user (reads are scoped to the caller inside the routes).
  api.route('/receipts', receiptRoutes(receipts));
  api.route('/dashboard', dashboardRoutes(dashboard));

  // Notices: reads and per-resident dismiss are open to any authenticated user;
  // creating and deleting notices is admin-only.
  api.on('POST', '/notices', requireRole('admin'));
  api.on('DELETE', '/notices/*', requireRole('admin'));
  api.route('/notices', noticeRoutes(notices));

  // Threads: listing all conversations is admin-only; per-thread access stays open.
  // A resident's thread is created lazily from their record on first use.
  api.on('GET', '/threads', requireRole('admin'));
  api.route(
    '/threads',
    threadRoutes(threads, async (id) => {
      const resident = await residents.getById(id);
      return resident ? { name: resident.name, apt: resident.apt } : null;
    }),
  );

  app.route('/api', api);

  return app;
}

export async function createApp(): Promise<Hono<ApiEnv>> {
  const { repos } = await createRepositories(config);
  return buildApp(repos);
}
