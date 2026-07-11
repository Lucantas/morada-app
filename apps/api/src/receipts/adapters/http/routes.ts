import { Hono } from 'hono';
import { z } from 'zod';

import type { ApiEnv } from '../../../platform/auth';
import { getReceipt } from '../../app/get-receipt';
import { listReceipts } from '../../app/list-receipts';
import { payReceipt } from '../../app/pay-receipt';
import type { ReceiptRepository } from '../../domain/receipt-repository';

const paySchema = z.object({ method: z.enum(['pix', 'boleto', 'cartao']) });

export function receiptRoutes(repo: ReceiptRepository) {
  const app = new Hono<ApiEnv>();

  app.get('/', (c) => c.json(listReceipts(repo)));

  app.get('/:id', (c) => c.json(getReceipt(repo, c.req.param('id'))));

  app.post('/:id/pay', async (c) => {
    const { method } = paySchema.parse(await c.req.json());
    return c.json(payReceipt(repo, c.req.param('id'), method));
  });

  return app;
}
