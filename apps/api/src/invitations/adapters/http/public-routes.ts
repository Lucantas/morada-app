import { Hono, type Context } from 'hono';
import { z } from 'zod';

import type { CondoSummary } from '../../../condos/app/condo-access-views';
import type { ApiEnv } from '../../../platform/auth';
import { clientIpFrom } from '../../../platform/client-ip';
import { consumeAttempt, type RateLimiter } from '../../../platform/rate-limit';
import { sessionResponse } from '../../../users/adapters/http/session-cookies';
import { acceptInvitation, type AcceptInvitationDeps } from '../../app/accept-invitation';
import { previewInvitation } from '../../app/preview-invitation';
import { InvalidInvitationError } from '../../domain/errors';

const TOO_MANY_ATTEMPTS = 'Muitas tentativas, tente mais tarde';
const tokenSchema = z.string().min(1).max(200);

export interface PublicInvitationRoutesDeps extends AcceptInvitationDeps {
  condosFor: (userId: string) => Promise<CondoSummary[]>;
  limiter: RateLimiter;
}

function tokenFrom(c: Context<ApiEnv>): string {
  const parsed = tokenSchema.safeParse(c.req.param('token'));
  if (!parsed.success) throw new InvalidInvitationError();
  return parsed.data;
}

export function publicInvitationRoutes(deps: PublicInvitationRoutesDeps) {
  const app = new Hono<ApiEnv>();

  const withinLimit = (c: Context<ApiEnv>): boolean =>
    consumeAttempt(deps.limiter, clientIpFrom(c), deps.now().getTime());

  app.get('/:token', async (c) => {
    if (!withinLimit(c)) return c.json({ error: TOO_MANY_ATTEMPTS }, 429);
    return c.json(await previewInvitation(deps, tokenFrom(c)));
  });

  app.post('/:token/accept', async (c) => {
    if (!withinLimit(c)) return c.json({ error: TOO_MANY_ATTEMPTS }, 429);
    const token = tokenFrom(c);
    const body: unknown = await c.req.json().catch(() => undefined);
    const user = await acceptInvitation(deps, token, body);
    return sessionResponse(c, user, await deps.condosFor(user.id));
  });

  return app;
}
