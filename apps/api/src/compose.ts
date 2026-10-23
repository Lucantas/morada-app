import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';

import { accountProofRoutes, accountRoutes } from './accounts/adapters/http/routes';
import { categoryRoutes } from './categories/adapters/http/routes';
import { meRoutes } from './condos/adapters/http/routes';
import { listMyCondos, resolveCondoAccess } from './condos/app/condo-access-views';
import { dashboardRoutes } from './dashboard/adapters/http/routes';
import { incomeRoutes } from './income/adapters/http/routes';
import { threadRoutes } from './messages/adapters/http/routes';
import { noticeRoutes } from './notices/adapters/http/routes';
import { authMiddleware, requireRole, type ApiEnv, type Role } from './platform/auth';
import { condoAccessMiddleware, type Scoped } from './platform/condo-scope';
import { csrfMiddleware } from './platform/csrf';
import { config } from './platform/config';
import { createRepositories, type CondoRepositories, type Repositories } from './repositories';
import { onError } from './platform/http-error';
import { healthRoutes } from './platform/http/health-routes';
import { createRateLimiter } from './platform/rate-limit';
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
  const { users, condos } = repos;
  const scoped =
    <T>(pick: (condoRepos: CondoRepositories) => T): Scoped<T> =>
    (condoId) =>
      pick(repos.forCondo(condoId));
  const hasher = new BcryptPasswordHasher(config.bcryptCost);
  // The seeded admin uses a weak, public password — never auto-seed it into a
  // real production database. Opt in explicitly with SEED_DEMO_DATA when needed.
  if (!config.isProduction || process.env.SEED_DEMO_DATA === '1') {
    await seedAdmin(users, condos, hasher);
  }

  const app = new Hono<ApiEnv>();
  app.onError(onError);
  app.use(
    '*',
    cors({
      origin: config.webOrigins,
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'X-CSRF-Token'],
    }),
  );
  app.use(
    '*',
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
      },
      xFrameOptions: 'DENY',
      referrerPolicy: 'strict-origin-when-cross-origin',
      strictTransportSecurity: config.isProduction ? true : false,
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
      },
    }),
  );

  app.route('/healthz', healthRoutes());

  const loginLimiter = createRateLimiter();
  app.route(
    '/auth',
    authRoutes({
      users,
      hasher,
      condosFor: (userId) => listMyCondos(condos, userId),
      limiter: loginLimiter,
    }),
  );
  app.route('/me', meRoutes(condos));

  const api = new Hono<ApiEnv>();
  api.use('*', authMiddleware);
  api.use('*', csrfMiddleware);
  api.use('*', condoAccessMiddleware(resolveCondoAccess(condos)));

  // Admin-only: provision a resident login. Returns the generated temp password
  // once for the admin to relay; only the hash is ever stored.
  api.route(
    '/users',
    userRoutes(
      scoped(({ residents }) => ({ users, residents, condos })),
      hasher,
    ),
  );

  // Residents router self-guards per-route: '/me' is resident-accessible,
  // everything else (including '/:id/login*') is admin-only.
  api.route(
    '/residents',
    residentRoutes(
      scoped(({ residents, receipts }) => ({ residents, receipts, users })),
      hasher,
    ),
  );

  // Account proof download: any authenticated user (admin or resident) — condo
  // expense proofs are shared building information. Mounted before the
  // admin-only CRUD below so it isn't caught by the admin guard.
  api.route('/accounts', accountProofRoutes(scoped(({ accounts }) => ({ accounts }))));

  // Admin-only resources.
  api.route('/accounts', guarded('admin', accountRoutes(scoped(({ accounts }) => ({ accounts })))));
  api.route('/incomes', guarded('admin', incomeRoutes(scoped(({ incomes }) => ({ incomes })))));
  api.route(
    '/categories',
    guarded(
      'admin',
      categoryRoutes(scoped(({ categories, accounts }) => ({ categories, accounts }))),
    ),
  );
  api.route(
    '/settings',
    guarded('admin', settingsRoutes(scoped(({ settings }) => ({ settings })))),
  );

  // Admin: apartment-scoped views — full receipt ledger and occupant history,
  // across every resident who has occupied the apartment (the resident-facing
  // view stays scoped to their own receipts).
  const apartments = new Hono<ApiEnv>();
  apartments.route('/', apartmentReceiptRoutes(scoped(({ receipts }) => ({ receipts }))));
  apartments.route('/', apartmentResidentRoutes(scoped(({ residents }) => ({ residents }))));
  api.route('/apartments', apartments);

  // Any authenticated user (reads are scoped to the caller inside the routes).
  api.route(
    '/receipts',
    receiptRoutes(
      scoped(({ residents, receipts, settings }) => ({
        receipts,
        residents,
        settings,
      })),
    ),
  );
  api.route('/dashboard', dashboardRoutes(scoped(({ dashboard }) => ({ dashboard }))));

  // Notices: reads and per-resident dismiss are open to any authenticated user;
  // creating and deleting notices is admin-only (guarded inside noticeRoutes).
  api.route('/notices', noticeRoutes(scoped(({ notices }) => ({ notices }))));

  // Threads: listing all conversations is admin-only (guarded inside threadRoutes);
  // per-thread access stays open. A resident's thread is created lazily from
  // their record on first use.
  api.route(
    '/threads',
    threadRoutes(
      scoped(({ threads }) => ({ threads })),
      (condoId) => async (id) => {
        const resident = await repos.forCondo(condoId).residents.getById(id);
        return resident
          ? { name: resident.name, apt: resident.apt, apartmentId: resident.apartmentId }
          : null;
      },
    ),
  );

  app.route('/api/condos/:condoId', api);

  return app;
}

export async function createApp(): Promise<Hono<ApiEnv>> {
  const { repos } = await createRepositories(config);
  return buildApp(repos);
}
