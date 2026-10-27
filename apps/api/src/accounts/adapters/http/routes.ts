import { Hono } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import type { Scoped } from '../../../platform/condo-scope';
import { archiveAccount } from '../../app/archive-account';
import { getAccount } from '../../app/get-account';
import { listAccounts } from '../../app/list-accounts';
import { saveAccount } from '../../app/save-account';
import { accountDraftSchema } from '../../domain/account';
import type { AccountRepository } from '../../domain/account-repository';

interface AccountRoutesDeps {
  accounts: AccountRepository;
}

function toArrayBufferView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(bytes);
}

// Proof download is available to any authenticated user (admin or resident) —
// condo expense proofs are shared building information. Mounted OUTSIDE the admin
// guard; the CRUD below stays admin-only.
export function accountProofRoutes(scope: Scoped<AccountRoutesDeps>): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>();
  app.get('/:id/proof', async (c) => {
    const { accounts: repo } = scope(c.get('condoId'));
    const account = await repo.getById(c.req.param('id'));
    if (!account) return c.json({ error: 'Conta não encontrada' }, 404);
    const proof = await repo.getProof(account.id);
    if (!proof) return c.json({ error: 'Comprovante não encontrado' }, 404);
    return c.body(toArrayBufferView(proof.body), 200, { 'Content-Type': proof.contentType });
  });
  return app;
}

export function accountRoutes(scope: Scoped<AccountRoutesDeps>) {
  const app = new Hono<ApiEnv>();

  app.get('/', async (c) => c.json(await listAccounts(scope(c.get('condoId')).accounts)));

  app.get('/:id', async (c) =>
    c.json(await getAccount(scope(c.get('condoId')).accounts, c.req.param('id'))),
  );

  app.post('/', async (c) => {
    const { accounts: repo } = scope(c.get('condoId'));
    const draft = accountDraftSchema.parse(await c.req.json());
    // POST always creates: ignore any client-supplied id so it can't overwrite.
    return c.json(await saveAccount(repo, { ...draft, id: undefined }), 201);
  });

  app.put('/:id', async (c) => {
    const { accounts: repo } = scope(c.get('condoId'));
    const id = c.req.param('id');
    const draft = accountDraftSchema.parse({ ...(await c.req.json()), id });
    const existed = (await repo.getById(id)) !== null;
    return c.json(await saveAccount(repo, draft), existed ? 200 : 201);
  });

  app.delete('/:id', async (c) => {
    await archiveAccount(scope(c.get('condoId')).accounts, c.req.param('id'));
    return c.body(null, 204);
  });

  return app;
}
