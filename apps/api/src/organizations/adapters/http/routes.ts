import { Hono } from 'hono';

import type { OrgInvitationRepository } from '../../../invitations/domain/invitation-repository';
import type { ApiEnv } from '../../../platform/auth';
import type { EmailSender } from '../../../platform/email/email-sender';
import { consumeAttempt, type RateLimiter } from '../../../platform/rate-limit';
import { assignCondos } from '../../app/assign-condos';
import { deactivateMember } from '../../app/deactivate-member';
import { getOrganization } from '../../app/get-organization';
import { inviteMember, revokeMemberInvitation } from '../../app/invite-member';
import { renameOrganization } from '../../app/rename-organization';
import type { OrganizationRepository } from '../../domain/organization-repository';

export interface OrganizationRoutesDeps {
  organizations: OrganizationRepository;
  invitations: OrgInvitationRepository;
  email: EmailSender;
  appUrl: string;
  now: () => Date;
  limiter: RateLimiter;
}

const TOO_MANY_ATTEMPTS = 'Muitas tentativas, tente mais tarde';

const readJson = (raw: Promise<unknown>): Promise<unknown> => raw.catch(() => undefined);

export function organizationRoutes(deps: OrganizationRoutesDeps) {
  const { organizations, invitations } = deps;
  const app = new Hono<ApiEnv>();

  app.get('/', async (c) =>
    c.json(await getOrganization({ organizations, invitations }, c.get('orgId'), deps.now())),
  );

  app.put('/', async (c) =>
    c.json(await renameOrganization(organizations, c.get('orgId'), await readJson(c.req.json()))),
  );

  app.post('/invitations', async (c) => {
    if (!consumeAttempt(deps.limiter, c.get('uid'), deps.now().getTime())) {
      return c.json({ error: TOO_MANY_ATTEMPTS }, 429);
    }
    const created = await inviteMember(
      deps,
      c.get('orgId'),
      c.get('uid'),
      await readJson(c.req.json()),
    );
    return c.json(created, 201);
  });

  app.post('/invitations/:id/revoke', async (c) => {
    await revokeMemberInvitation(invitations, c.get('orgId'), c.req.param('id'));
    return c.body(null, 204);
  });

  app.post('/members/:userId/deactivate', async (c) => {
    await deactivateMember(organizations, c.get('orgId'), c.get('uid'), c.req.param('userId'));
    return c.body(null, 204);
  });

  app.put('/members/:userId/condos', async (c) =>
    c.json(
      await assignCondos(
        organizations,
        c.get('orgId'),
        c.req.param('userId'),
        await readJson(c.req.json()),
      ),
    ),
  );

  return app;
}
