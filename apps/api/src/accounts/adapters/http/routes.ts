import { Hono } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import { getAccount } from '../../app/get-account';
import { listAccounts } from '../../app/list-accounts';
import { saveAccount } from '../../app/save-account';
import { accountDraftSchema } from '../../domain/account';
import type { AccountRepository } from '../../domain/account-repository';

export function accountRoutes(repo: AccountRepository) {
  const app = new Hono<ApiEnv>();

  app.get('/', (c) => c.json(listAccounts(repo)));

  app.get('/:id', (c) => c.json(getAccount(repo, c.req.param('id'))));

  app.post('/', async (c) => {
    const draft = accountDraftSchema.parse(await c.req.json());
    return c.json(saveAccount(repo, draft), 201);
  });

  app.put('/:id', async (c) => {
    const draft = accountDraftSchema.parse({ ...(await c.req.json()), id: c.req.param('id') });
    return c.json(saveAccount(repo, draft));
  });

  return app;
}
