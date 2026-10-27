import { Hono } from 'hono';

import type { CondoRepository } from '../../../condos/domain/condo-repository';
import { requirePermission, type ApiEnv } from '../../../platform/auth';
import type { Scoped } from '../../../platform/condo-scope';
import type { EmailSender } from '../../../platform/email/email-sender';
import { consumeAttempt, type RateLimiter } from '../../../platform/rate-limit';
import { createSindicoInvitation } from '../../app/create-sindico-invitation';
import { getSindico } from '../../app/get-sindico';
import { removeSindico } from '../../app/remove-sindico';
import { revokeSindicoInvitation } from '../../app/revoke-sindico-invitation';
import type { CondoInvitationRepository } from '../../domain/invitation-repository';

interface SindicoRoutesContext {
  condos: CondoRepository;
  email: EmailSender;
  appUrl: string;
  now: () => Date;
  limiter: RateLimiter;
}

const TOO_MANY_ATTEMPTS = 'Muitas tentativas, tente mais tarde';

export function sindicoRoutes(
  scope: Scoped<{ invitations: CondoInvitationRepository }>,
  context: SindicoRoutesContext,
) {
  const app = new Hono<ApiEnv>();
  app.use('*', requirePermission('manage_condo'));

  app.get('/', async (c) => {
    const condoId = c.get('condoId');
    const view = await getSindico(
      { ...scope(condoId), condos: context.condos },
      condoId,
      context.now(),
    );
    return c.json(view);
  });

  app.post('/invitation', async (c) => {
    if (!consumeAttempt(context.limiter, c.get('uid'), context.now().getTime())) {
      return c.json({ error: TOO_MANY_ATTEMPTS }, 429);
    }
    const condoId = c.get('condoId');
    const body: unknown = await c.req.json().catch(() => undefined);
    const created = await createSindicoInvitation(
      { ...scope(condoId), ...context },
      condoId,
      c.get('uid'),
      body,
    );
    return c.json(created, 201);
  });

  app.post('/invitation/revoke', async (c) => {
    await revokeSindicoInvitation(scope(c.get('condoId')));
    return c.body(null, 204);
  });

  app.post('/remove', async (c) => {
    await removeSindico(context, c.get('condoId'));
    return c.body(null, 204);
  });

  return app;
}
