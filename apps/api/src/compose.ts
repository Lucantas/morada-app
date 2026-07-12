import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';

import { accountRoutes } from './accounts/adapters/http/routes';
import { SqliteAccountRepository } from './accounts/adapters/sqlite/account-repository';
import { dashboardRoutes } from './dashboard/adapters/http/routes';
import { SqliteDashboardRepository } from './dashboard/adapters/sqlite/dashboard-repository';
import { threadRoutes } from './messages/adapters/http/routes';
import { SqliteThreadRepository } from './messages/adapters/sqlite/thread-repository';
import { noticeRoutes } from './notices/adapters/http/routes';
import { SqliteNoticeRepository } from './notices/adapters/sqlite/notice-repository';
import { authMiddleware, requireRole, signSession, type ApiEnv, type Role } from './platform/auth';
import { config } from './platform/config';
import { createDb, type Db } from './platform/db';
import { onError } from './platform/http-error';
import { receiptRoutes } from './receipts/adapters/http/routes';
import { SqliteReceiptRepository } from './receipts/adapters/sqlite/receipt-repository';
import { residentRoutes } from './residents/adapters/http/routes';
import { SqliteResidentRepository } from './residents/adapters/sqlite/resident-repository';
import { seedDatabase } from './seed-data';
import { generateTempPassword } from './platform/temp-password';
import { createResidentLogin } from './users/app/create-resident-login';
import { verifyCredentials } from './users/app/verify-credentials';
import { BcryptPasswordHasher } from './users/adapters/bcrypt/bcrypt-password-hasher';
import { SqliteUserRepository } from './users/adapters/sqlite/user-repository';
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

export function buildApp(db: Db) {
  seedDatabase(db);
  const residents = new SqliteResidentRepository(db);
  const accounts = new SqliteAccountRepository(db);
  const receipts = new SqliteReceiptRepository(db);
  const notices = new SqliteNoticeRepository(db);
  const threads = new SqliteThreadRepository(db);
  const dashboard = new SqliteDashboardRepository(db);
  const users = new SqliteUserRepository(db);
  const hasher = new BcryptPasswordHasher(config.bcryptCost);

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
    const user = await createResidentLogin(users, hasher, {
      username,
      password: tempPassword,
      residentId,
    });
    return c.json(
      { id: user.id, username: user.username, residentId: user.residentId, tempPassword },
      201,
    );
  });

  // Admin-only resources.
  api.route('/residents', guarded('admin', residentRoutes(residents)));
  api.route('/accounts', guarded('admin', accountRoutes(accounts)));

  // Any authenticated user.
  api.route('/receipts', receiptRoutes(receipts));
  api.route('/dashboard', dashboardRoutes(dashboard));

  // Notices: reads open to any authenticated user, writes admin-only.
  api.on(['POST', 'DELETE'], '/notices/*', requireRole('admin'));
  api.on('POST', '/notices', requireRole('admin'));
  api.route('/notices', noticeRoutes(notices));

  // Threads: listing all conversations is admin-only; per-thread access stays open.
  api.on('GET', '/threads', requireRole('admin'));
  api.route('/threads', threadRoutes(threads));

  app.route('/api', api);

  return app;
}

export function createApp() {
  return buildApp(createDb(config.dbPath));
}
