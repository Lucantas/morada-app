import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';

import { moneyActivityResolver } from './activity/adapters/http/money-activity';
import { recordActivity } from './activity/adapters/http/record-activity';
import { activityRoutes } from './activity/adapters/http/routes';
import { accountProofRoutes, accountRoutes } from './accounts/adapters/http/routes';
import { categoryRoutes } from './categories/adapters/http/routes';
import { onboardingRoutes } from './condos/adapters/http/onboarding-routes';
import { condoInfoRoutes, meRoutes } from './condos/adapters/http/routes';
import { listMyCondos, resolveCondoAccess } from './condos/app/condo-access-views';
import { dashboardRoutes } from './dashboard/adapters/http/routes';
import { incomeRoutes } from './income/adapters/http/routes';
import { publicInvitationRoutes } from './invitations/adapters/http/public-routes';
import { invitationRoutes } from './invitations/adapters/http/routes';
import { sindicoRoutes } from './invitations/adapters/http/sindico-routes';
import { activateClaimedInvitations } from './invitations/app/activate-claimed-invitations';
import { threadRoutes } from './messages/adapters/http/routes';
import { noticeRoutes } from './notices/adapters/http/routes';
import { orgOwnerMiddleware } from './organizations/adapters/http/org-access';
import { organizationRoutes } from './organizations/adapters/http/routes';
import { authMiddleware, requireRole, type ApiEnv, type Role } from './platform/auth';
import { condoAccessMiddleware, VIEW_HEADER, type Scoped } from './platform/condo-scope';
import { csrfMiddleware } from './platform/csrf';
import { config } from './platform/config';
import { createRepositories, type CondoRepositories, type Repositories } from './repositories';
import { onError } from './platform/http-error';
import { healthRoutes } from './platform/http/health-routes';
import { createEmailSender } from './platform/email/create-email-sender';
import type { EmailSender } from './platform/email/email-sender';
import { createRateLimiter } from './platform/rate-limit';
import { apartmentReceiptRoutes } from './receipts/adapters/http/apartment-routes';
import { receiptRoutes } from './receipts/adapters/http/routes';
import { apartmentResidentRoutes } from './residents/adapters/http/apartment-routes';
import { residentRoutes } from './residents/adapters/http/routes';
import { seedAdmin } from './seed-data';
import { pixRoutes } from './settings/adapters/http/pix-routes';
import { settingsRoutes } from './settings/adapters/http/routes';
import { authRoutes } from './users/adapters/http/auth-routes';
import { BcryptPasswordHasher } from './users/adapters/bcrypt/bcrypt-password-hasher';

function guarded(role: Role, routes: Hono<ApiEnv>): Hono<ApiEnv> {
  const group = new Hono<ApiEnv>();
  group.use('*', requireRole(role));
  group.route('/', routes);
  return group;
}

const SIGNUP_LIMIT = { maxAttempts: 10, windowMs: 3_600_000, lockoutMs: 3_600_000 };
const INVITATION_CREATE_LIMIT = { maxAttempts: 30, windowMs: 3_600_000, lockoutMs: 3_600_000 };

export interface AppOptions {
  email?: EmailSender;
  now?: () => Date;
}

export async function buildApp(repos: Repositories, opts?: AppOptions): Promise<Hono<ApiEnv>> {
  const { users, condos, authTokens } = repos;
  const email = opts?.email ?? createEmailSender(config);
  const now = opts?.now ?? (() => new Date());
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
      allowHeaders: ['Content-Type', 'X-CSRF-Token', VIEW_HEADER],
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

  const auth = authMiddleware((userId) => users.sessionVersionOf(userId));
  const loginLimiter = createRateLimiter();
  const signupLimiter = createRateLimiter(SIGNUP_LIMIT);
  const invitationLimiter = createRateLimiter(SIGNUP_LIMIT);
  const invitationCreateLimiter = createRateLimiter(INVITATION_CREATE_LIMIT);
  const condosFor = (userId: string) => listMyCondos(condos, userId);
  const invitationAccess = {
    invitations: repos.invitationTokens,
    condos,
    users,
    residentsFor: (condoId: string) => repos.forCondo(condoId).residents,
    now,
  };
  const activateClaimed = (userId: string) => activateClaimedInvitations(invitationAccess, userId);
  app.route(
    '/auth',
    authRoutes({
      auth,
      users,
      hasher,
      condosFor,
      limiter: loginLimiter,
      tokens: authTokens,
      email,
      appUrl: config.appUrl,
      now,
      signupLimiter,
      afterEmailConfirmed: activateClaimed,
      onVerifiedLogin: activateClaimed,
      onCredentialsReplaced: (userId) => repos.invitationTokens.releaseClaims(userId),
    }),
  );
  app.route(
    '/auth/invitations',
    publicInvitationRoutes({
      ...invitationAccess,
      hasher,
      tokens: authTokens,
      email,
      appUrl: config.appUrl,
      activateClaimed,
      condosFor,
      limiter: invitationLimiter,
    }),
  );
  app.route('/me', meRoutes({ auth, condos, users }));

  const api = new Hono<ApiEnv>();
  api.use('*', auth);
  api.use('*', csrfMiddleware);
  api.use('*', condoAccessMiddleware(resolveCondoAccess(condos)));

  const logMoneyActivity = recordActivity(
    moneyActivityResolver,
    scoped(({ activity }) => ({ record: (entry) => activity.record(entry) })),
    now,
  );
  for (const prefix of ['accounts', 'incomes', 'categories', 'receipts', 'residents']) {
    api.use(`/${prefix}/*`, logMoneyActivity);
  }

  api.route('/info', condoInfoRoutes(condos));
  api.route('/onboarding', onboardingRoutes(condos));
  api.route('/activity', activityRoutes(scoped(({ activity }) => ({ activity }))));

  // Residents router self-guards per-route: '/me' is resident-accessible,
  // everything else (including '/:id/login*') is admin-only.
  api.route(
    '/residents',
    residentRoutes(
      scoped(({ residents, receipts }) => ({ residents, receipts, users })),
      hasher,
    ),
  );

  api.route(
    '/residents',
    invitationRoutes(
      scoped(({ residents, invitations }) => ({ residents, invitations })),
      { condos, email, appUrl: config.appUrl, now, limiter: invitationCreateLimiter },
    ),
  );

  api.route(
    '/sindico',
    sindicoRoutes(
      scoped(({ invitations }) => ({ invitations })),
      { condos, email, appUrl: config.appUrl, now, limiter: invitationCreateLimiter },
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

  api.route('/pix', pixRoutes(scoped(({ settings }) => ({ settings }))));

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

  const org = new Hono<ApiEnv>();
  org.use('*', auth);
  org.use('*', csrfMiddleware);
  org.use('*', orgOwnerMiddleware(repos.organizations));
  org.route(
    '/',
    organizationRoutes({
      organizations: repos.organizations,
      invitations: repos.orgInvitations,
      email,
      appUrl: config.appUrl,
      now,
      limiter: invitationCreateLimiter,
    }),
  );
  app.route('/api/orgs/:orgId', org);

  return app;
}

export async function createApp(): Promise<Hono<ApiEnv>> {
  const { repos } = await createRepositories(config);
  return buildApp(repos);
}
