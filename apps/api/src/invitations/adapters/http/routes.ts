import { Hono } from 'hono';
import { z } from 'zod';

import type { CondoRepository } from '../../../condos/domain/condo-repository';
import { requireRole, type ApiEnv } from '../../../platform/auth';
import type { Scoped } from '../../../platform/condo-scope';
import type { EmailSender } from '../../../platform/email/email-sender';
import { consumeAttempt, type RateLimiter } from '../../../platform/rate-limit';
import type { ResidentRepository } from '../../../residents/domain/resident-repository';
import { createInvitation } from '../../app/create-invitation';
import { getInvitationStatus } from '../../app/get-invitation-status';
import { revokeInvitation } from '../../app/revoke-invitation';
import type { CondoInvitationRepository } from '../../domain/invitation-repository';

interface InvitationRoutesDeps {
  invitations: CondoInvitationRepository;
  residents: ResidentRepository;
}

interface InvitationRoutesContext {
  condos: CondoRepository;
  email: EmailSender;
  appUrl: string;
  now: () => Date;
  limiter: RateLimiter;
}

const TOO_MANY_ATTEMPTS = 'Muitas tentativas, tente mais tarde';

const createBodySchema = z.object({ email: z.string().max(160).optional() });

function readBody(raw: string): unknown {
  if (raw === '') return {};
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function invitationRoutes(
  scope: Scoped<InvitationRoutesDeps>,
  context: InvitationRoutesContext,
) {
  const app = new Hono<ApiEnv>();

  app.post('/:id/invitation', requireRole('admin'), async (c) => {
    if (!consumeAttempt(context.limiter, c.get('uid'), context.now().getTime())) {
      return c.json({ error: TOO_MANY_ATTEMPTS }, 429);
    }
    const body = createBodySchema.parse(readBody(await c.req.text()));
    const created = await createInvitation(
      { ...scope(c.get('condoId')), ...context },
      c.get('condoId'),
      c.req.param('id'),
      c.get('uid'),
      body.email,
    );
    return c.json(created, 201);
  });

  app.get('/:id/invitation', requireRole('admin'), async (c) => {
    const view = await getInvitationStatus(
      scope(c.get('condoId')),
      c.req.param('id'),
      context.now(),
    );
    return c.json(view);
  });

  app.post('/:id/invitation/revoke', requireRole('admin'), async (c) => {
    await revokeInvitation(scope(c.get('condoId')), c.req.param('id'));
    return c.body(null, 204);
  });

  return app;
}
