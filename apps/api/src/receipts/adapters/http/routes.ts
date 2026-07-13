import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';

import type { ApiEnv } from '../../../platform/auth';
import { getReceipt } from '../../app/get-receipt';
import { listReceipts } from '../../app/list-receipts';
import { listResidentReceipts } from '../../app/list-resident-receipts';
import { payReceipt } from '../../app/pay-receipt';
import type { Receipt } from '../../domain/receipt';
import type { ReceiptRepository } from '../../domain/receipt-repository';

const paySchema = z.object({ method: z.enum(['pix', 'boleto', 'cartao']) });

// A resident may only see/pay their own receipts; admins are unrestricted.
function denyForeignReceipt(c: Context<ApiEnv>, receipt: Receipt): Response | null {
  if (c.get('role') === 'resident' && receipt.residentId !== c.get('sub')) {
    return c.json({ error: 'Acesso negado' }, 403);
  }
  return null;
}

export function receiptRoutes(repo: ReceiptRepository) {
  const app = new Hono<ApiEnv>();

  app.get('/', async (c) =>
    c.json(
      c.get('role') === 'resident'
        ? await listResidentReceipts(repo, c.get('sub'))
        : await listReceipts(repo),
    ),
  );

  app.get('/:id', async (c) => {
    const receipt = await getReceipt(repo, c.req.param('id'));
    const denied = denyForeignReceipt(c, receipt);
    return denied ?? c.json(receipt);
  });

  app.post('/:id/pay', async (c) => {
    const receipt = await getReceipt(repo, c.req.param('id'));
    const denied = denyForeignReceipt(c, receipt);
    if (denied) return denied;
    const { method } = paySchema.parse(await c.req.json());
    return c.json(await payReceipt(repo, c.req.param('id'), method));
  });

  return app;
}
