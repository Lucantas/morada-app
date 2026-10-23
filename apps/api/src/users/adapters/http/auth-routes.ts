import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie } from 'hono/cookie';
import { z } from 'zod';

import { currentSessionUser, type ApiEnv } from '../../../platform/auth';
import type { CondoSummary } from '../../../condos/app/condo-access-views';
import { config } from '../../../platform/config';
import { CSRF_COOKIE, SESSION_COOKIE, clearCookieOptions } from '../../../platform/cookies';
import { csrfMiddleware } from '../../../platform/csrf';
import type { EmailSender } from '../../../platform/email/email-sender';
import { clientIpFrom } from '../../../platform/client-ip';
import { consumeAttempt, type RateLimiter } from '../../../platform/rate-limit';
import { confirmEmail } from '../../app/confirm-email';
import { requestPasswordReset } from '../../app/request-password-reset';
import { resendConfirmation } from '../../app/resend-confirmation';
import { resetPassword } from '../../app/reset-password';
import { signUp } from '../../app/sign-up';
import type { AuthTokenRepository } from '../../domain/auth-token-repository';
import { verifyCredentials } from '../../app/verify-credentials';
import { normalizeEmail } from '../../domain/email';
import { InvalidCredentialsError, InvalidLinkError } from '../../domain/errors';
import type { PasswordHasher } from '../../domain/password-hasher';
import type { UserRepository } from '../../domain/user-repository';

import { sessionResponse } from './session-cookies';

const TOO_MANY_ATTEMPTS = 'Muitas tentativas, tente mais tarde';

const loginSchema = z
  .object({
    login: z.string().min(1).max(160).optional(),
    username: z.string().min(1).max(160).optional(),
    password: z.string().min(1).max(200),
  })
  .refine((body) => (body.login === undefined) !== (body.username === undefined), {
    message: 'Informe login',
  })
  .transform(({ login, username, password }) => ({
    login: (login ?? username ?? '').trim(),
    password,
  }));

const tokenBodySchema = z.object({ token: z.string().min(1).max(200) });
const confirmBodySchema = z.object({ password: z.string().min(1).max(200) });
const resetBodySchema = z.object({ password: z.unknown() });

function tokenFrom(body: unknown): string {
  const parsed = tokenBodySchema.safeParse(body);
  if (!parsed.success) throw new InvalidLinkError();
  return parsed.data.token;
}

function readJson(c: Context<ApiEnv>): Promise<unknown> {
  return c.req.json().catch(() => undefined);
}

async function endServerSession(users: UserRepository, token: string | undefined): Promise<void> {
  if (!token) return;
  const uid = await currentSessionUser(token, (id) => users.sessionVersionOf(id));
  if (uid !== null) await users.bumpSessionVersion(uid);
}

export function authRoutes(deps: {
  auth: MiddlewareHandler<ApiEnv>;
  users: UserRepository;
  hasher: PasswordHasher;
  condosFor: (userId: string) => Promise<CondoSummary[]>;
  limiter: RateLimiter;
  tokens: AuthTokenRepository;
  email: EmailSender;
  appUrl: string;
  now: () => Date;
  signupLimiter: RateLimiter;
  afterEmailConfirmed: (userId: string) => Promise<void>;
  onVerifiedLogin: (userId: string) => Promise<void>;
  onCredentialsReplaced: (userId: string) => Promise<void>;
}) {
  const app = new Hono<ApiEnv>();

  const withinSignupLimit = (c: Context<ApiEnv>): boolean =>
    consumeAttempt(deps.signupLimiter, clientIpFrom(c), deps.now().getTime());

  app.post('/login', async (c) => {
    const { login, password } = loginSchema.parse(await c.req.json());
    const key = `${clientIpFrom(c)}:${login.includes('@') ? normalizeEmail(login) : login}`;

    if (!deps.limiter.check(key, Date.now()).allowed) {
      return c.json({ error: TOO_MANY_ATTEMPTS }, 429);
    }

    let user;
    try {
      user = await verifyCredentials(deps.users, deps.hasher, login, password);
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        deps.limiter.fail(key, Date.now());
      }
      throw error;
    }

    if (user.email !== null && user.emailVerifiedAt !== null) await deps.onVerifiedLogin(user.id);
    const condos = await deps.condosFor(user.id);
    if (condos.length === 0 && user.email === null) throw new InvalidCredentialsError();

    deps.limiter.succeed(key);
    return sessionResponse(c, user, condos);
  });

  app.post('/signup', async (c) => {
    if (!withinSignupLimit(c)) return c.json({ error: TOO_MANY_ATTEMPTS }, 429);
    await signUp(
      {
        users: deps.users,
        tokens: deps.tokens,
        hasher: deps.hasher,
        email: deps.email,
        appUrl: deps.appUrl,
        now: deps.now,
        onCredentialsReplaced: deps.onCredentialsReplaced,
      },
      await readJson(c),
    );
    return c.json({}, 202);
  });

  app.post('/email/confirm', async (c) => {
    const body = await readJson(c);
    const token = tokenFrom(body);
    const { password } = confirmBodySchema.parse(body);
    const user = await confirmEmail(
      {
        users: deps.users,
        tokens: deps.tokens,
        hasher: deps.hasher,
        now: deps.now,
        afterEmailConfirmed: deps.afterEmailConfirmed,
      },
      { token, password },
    );
    return sessionResponse(c, user, await deps.condosFor(user.id));
  });

  app.post('/password/forgot', async (c) => {
    if (!withinSignupLimit(c)) return c.json({ error: TOO_MANY_ATTEMPTS }, 429);
    await requestPasswordReset(
      {
        users: deps.users,
        tokens: deps.tokens,
        email: deps.email,
        appUrl: deps.appUrl,
        now: deps.now,
      },
      await readJson(c),
    );
    return c.body(null, 204);
  });

  app.post('/password/reset', async (c) => {
    const body = await readJson(c);
    const token = tokenFrom(body);
    const { password } = resetBodySchema.parse(body);
    const user = await resetPassword(
      {
        users: deps.users,
        tokens: deps.tokens,
        hasher: deps.hasher,
        now: deps.now,
        afterEmailConfirmed: deps.afterEmailConfirmed,
        onCredentialsReplaced: deps.onCredentialsReplaced,
      },
      { token, password },
    );
    return sessionResponse(c, user, await deps.condosFor(user.id));
  });

  app.post('/email/resend', deps.auth, csrfMiddleware, async (c) => {
    if (!withinSignupLimit(c)) return c.json({ error: TOO_MANY_ATTEMPTS }, 429);
    await resendConfirmation(
      {
        users: deps.users,
        tokens: deps.tokens,
        email: deps.email,
        appUrl: deps.appUrl,
        now: deps.now,
      },
      c.get('uid'),
    );
    return c.body(null, 204);
  });

  app.post('/logout', csrfMiddleware, async (c) => {
    await endServerSession(deps.users, getCookie(c, SESSION_COOKIE));
    deleteCookie(c, SESSION_COOKIE, clearCookieOptions(config.isProduction));
    deleteCookie(c, CSRF_COOKIE, clearCookieOptions(config.isProduction));
    return c.body(null, 204);
  });

  return app;
}
