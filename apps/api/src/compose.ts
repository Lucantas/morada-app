import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { accountRoutes } from './accounts/adapters/http/routes';
import { categoryRoutes } from './categories/adapters/http/routes';
import { dashboardRoutes } from './dashboard/adapters/http/routes';
import { incomeRoutes } from './income/adapters/http/routes';
import { threadRoutes } from './messages/adapters/http/routes';
import { noticeRoutes } from './notices/adapters/http/routes';
import { authMiddleware, requireRole, type ApiEnv, type Role } from './platform/auth';
import { config } from './platform/config';
import { createRepositories, type Repositories } from './repositories';
import { onError } from './platform/http-error';
import { apartmentReceiptRoutes } from './receipts/adapters/http/apartment-routes';
import { receiptRoutes } from './receipts/adapters/http/routes';
import { apartmentResidentRoutes } from './residents/adapters/http/apartment-routes';
import { residentRoutes } from './residents/adapters/http/routes';
import { seedAdmin } from './seed-data';
import { settingsRoutes } from './settings/adapters/http/routes';
import { authRoutes } from './users/adapters/http/auth-routes';
import { userRoutes } from './users/adapters/http/routes';
import { BcryptPasswordHasher } from './users/adapters/bcrypt/bcrypt-password-hasher';

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
  const isResidentActive = async (residentId: string | null): Promise<boolean> =>
    residentId !== null && (await residents.getById(residentId))?.active === true;
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

  app.route('/auth', authRoutes({ users, hasher, isResidentActive }));

  const api = new Hono<ApiEnv>();
  api.use('*', authMiddleware);

  api.use('*', async (c, next) => {
    if (c.get('role') === 'resident' && !(await isResidentActive(c.get('sub')))) {
      return c.json({ error: 'Sessão inválida' }, 401);
    }
    await next();
  });

  // Admin-only: provision a resident login. Returns the generated temp password
  // once for the admin to relay; only the hash is ever stored.
  api.route('/users', userRoutes({ users, hasher, residents }));

  // Residents router self-guards per-route: '/me' is resident-accessible,
  // everything else (including '/:id/login*') is admin-only.
  api.route('/residents', residentRoutes({ residents, receipts, users, hasher }));

  // Admin-only resources.
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

  // Admin: apartment-scoped views — full receipt ledger and occupant history,
  // across every resident who has occupied the apartment (the resident-facing
  // view stays scoped to their own receipts).
  const apartments = new Hono<ApiEnv>();
  apartments.route('/', apartmentReceiptRoutes({ receipts }));
  apartments.route('/', apartmentResidentRoutes({ residents }));
  api.route('/apartments', apartments);

  // Any authenticated user (reads are scoped to the caller inside the routes).
  api.route('/receipts', receiptRoutes({ receipts, residents, settings }));
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
