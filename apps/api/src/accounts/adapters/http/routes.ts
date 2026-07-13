import { Hono } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import { getAccount } from '../../app/get-account';
import { listAccounts } from '../../app/list-accounts';
import { saveAccount } from '../../app/save-account';
import { accountDraftSchema } from '../../domain/account';
import type { AccountRepository } from '../../domain/account-repository';

export function accountRoutes(repo: AccountRepository) {
  const app = new Hono<ApiEnv>();

  app.get('/', async (c) => c.json(await listAccounts(repo)));

  app.get('/:id', async (c) => c.json(await getAccount(repo, c.req.param('id'))));

  app.post('/', async (c) => {
    const draft = accountDraftSchema.parse(await c.req.json());
    // POST always creates: ignore any client-supplied id so it can't overwrite.
    return c.json(await saveAccount(repo, { ...draft, id: undefined }), 201);
  });

  app.put('/:id', async (c) => {
    const draft = accountDraftSchema.parse({ ...(await c.req.json()), id: c.req.param('id') });
    return c.json(await saveAccount(repo, draft));
  });

  return app;
}
