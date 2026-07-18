import { Hono } from 'hono';

import { requireRole, type ApiEnv } from '../../../platform/auth';
import { generateTempPassword } from '../../../platform/temp-password';
import type { ReceiptRepository } from '../../../receipts/domain/receipt-repository';
import { resetResidentPassword } from '../../../users/app/reset-resident-password';
import type { PasswordHasher } from '../../../users/domain/password-hasher';
import type { UserRepository } from '../../../users/domain/user-repository';
import { deactivateResident } from '../../app/deactivate-resident';
import { getResident } from '../../app/get-resident';
import { listResidents } from '../../app/list-residents';
import { overrideStatus } from '../../app/override-status';
import { saveResident } from '../../app/save-resident';
import { residentDraftSchema } from '../../domain/resident';
import type { ResidentRepository } from '../../domain/resident-repository';

interface ResidentRoutesDeps {
  residents: ResidentRepository;
  receipts: ReceiptRepository;
  users: UserRepository;
  hasher: PasswordHasher;
}

export function residentRoutes({ residents, receipts, users, hasher }: ResidentRoutesDeps) {
  const app = new Hono<ApiEnv>();

  // A resident reads their own record by their JWT subject (before the
  // admin-only routes below, which would otherwise 403 this).
  app.get('/me', async (c) => c.json(await getResident(residents, receipts, c.get('sub'))));

  // Admin-only: read a resident's login username (never the hash), or reset
  // their password to a fresh temp one. Registered before '/:id' below or
  // they would be shadowed by its generic param match.
  app.get('/:id/login', requireRole('admin'), async (c) => {
    const user = await users.findByResidentId(c.req.param('id'));
    return c.json(user ? { username: user.username } : null);
  });
  app.post('/:id/login/reset', requireRole('admin'), async (c) => {
    const tempPassword = generateTempPassword();
    const user = await resetResidentPassword(users, hasher, c.req.param('id'), tempPassword);
    return c.json({ username: user.username, tempPassword });
  });

  app.get('/', requireRole('admin'), async (c) => c.json(await listResidents(residents, receipts)));

  app.get('/:id', requireRole('admin'), async (c) =>
    c.json(await getResident(residents, receipts, c.req.param('id'))),
  );

  app.post('/', requireRole('admin'), async (c) => {
    const draft = residentDraftSchema.parse(await c.req.json());
    // POST always creates: ignore any client-supplied id so it can't overwrite.
    return c.json(await saveResident(residents, { ...draft, id: undefined }), 201);
  });

  app.put('/:id', requireRole('admin'), async (c) => {
    const draft = residentDraftSchema.parse({ ...(await c.req.json()), id: c.req.param('id') });
    return c.json(await saveResident(residents, draft));
  });

  // Move-out: free the apartment for the next occupant (history preserved).
  app.post('/:id/deactivate', requireRole('admin'), async (c) => {
    await deactivateResident(residents, c.req.param('id'));
    return c.body(null, 204);
  });

  app.put('/:id/status', requireRole('admin'), async (c) => {
    await overrideStatus(residents, c.req.param('id'), await c.req.json());
    return c.json({ ok: true });
  });

  return app;
}
