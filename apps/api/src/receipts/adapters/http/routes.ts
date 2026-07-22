import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';

import { requireRole, type ApiEnv } from '../../../platform/auth';
import type { ResidentRepository } from '../../../residents/domain/resident-repository';
import type { SettingsRepository } from '../../../settings/domain/settings-repository';
import { archiveReceipt } from '../../app/archive-receipt';
import { confirmPayment } from '../../app/confirm-payment';
import { createReceipt } from '../../app/create-receipt';
import { editReceipt } from '../../app/edit-receipt';
import { generateMonthlyReceipts } from '../../app/generate-monthly-receipts';
import { getReceipt } from '../../app/get-receipt';
import { listReceipts } from '../../app/list-receipts';
import { listResidentReceipts } from '../../app/list-resident-receipts';
import { payReceipt } from '../../app/pay-receipt';
import { rejectPayment } from '../../app/reject-payment';
import { submitPayment } from '../../app/submit-payment';
import type { Receipt } from '../../domain/receipt';
import type { ReceiptRepository } from '../../domain/receipt-repository';

const paySchema = z.object({
  method: z.enum(['dinheiro', 'pix']),
  paidAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

// A resident may only see/pay their own receipts; admins are unrestricted.
function denyForeignReceipt(c: Context<ApiEnv>, receipt: Receipt): Response | null {
  if (c.get('role') === 'resident' && receipt.residentId !== c.get('sub')) {
    return c.json({ error: 'Acesso negado' }, 403);
  }
  return null;
}

function toArrayBufferView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(bytes);
}

interface ReceiptRoutesDeps {
  receipts: ReceiptRepository;
  residents: ResidentRepository;
  settings: SettingsRepository;
}

export function receiptRoutes({ receipts: repo, residents, settings }: ReceiptRoutesDeps) {
  const app = new Hono<ApiEnv>();

  // Issuing a charge is admin-only; reads/pay (mounted below) are per-resident.
  app.post('/', requireRole('admin'), async (c) =>
    c.json(await createReceipt(repo, (id) => residents.apartmentOf(id), await c.req.json()), 201),
  );

  // Editing a receipt (ref/title/valueCents/dueDate) is admin-only; must be
  // registered before the generic resident '/:id' route below or it would be
  // shadowed.
  app.put('/:id', requireRole('admin'), async (c) =>
    c.json(await editReceipt(repo, c.req.param('id'), await c.req.json())),
  );

  // Admin: confirm or reject a resident's submitted payment (status
  // 'em_analise'); both must be registered before the generic resident
  // '/:id' route below or they would be shadowed.
  app.post('/:id/confirm', requireRole('admin'), async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { paidAt?: string };
    const paidAt = body.paidAt ?? new Date().toISOString().slice(0, 10);
    return c.json(await confirmPayment(repo, c.req.param('id'), paidAt));
  });
  app.post('/:id/reject', requireRole('admin'), async (c) =>
    c.json(await rejectPayment(repo, c.req.param('id'))),
  );

  // Admin-only: create the missing monthly condo-fee receipts, idempotently
  // (one 'pendente' charge per active resident for the current ref/month).
  app.post('/ensure-month', requireRole('admin'), async (c) =>
    c.json(
      await generateMonthlyReceipts(
        repo,
        residents,
        settings,
        new Date().toISOString().slice(0, 10),
      ),
      201,
    ),
  );

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

  app.get('/:id/proof', async (c) => {
    const receipt = await repo.getById(c.req.param('id'));
    if (!receipt) return c.json({ error: 'Recibo não encontrado' }, 404);
    const forbidden = denyForeignReceipt(c, receipt);
    if (forbidden) return forbidden;
    const proof = await repo.getProof(receipt.id);
    if (!proof) return c.json({ error: 'Comprovante não encontrado' }, 404);
    return c.body(toArrayBufferView(proof.body), 200, { 'Content-Type': proof.contentType });
  });

  app.post('/:id/pay', async (c) => {
    const receipt = await getReceipt(repo, c.req.param('id'));
    const denied = denyForeignReceipt(c, receipt);
    if (denied) return denied;
    if (c.get('role') !== 'admin') return c.json({ error: 'Acesso negado' }, 403);
    const { method, paidAt } = paySchema.parse(await c.req.json());
    return c.json(await payReceipt(repo, c.req.param('id'), method, paidAt));
  });

  app.post('/:id/submit-payment', async (c) => {
    const receipt = await getReceipt(repo, c.req.param('id'));
    const denied = denyForeignReceipt(c, receipt);
    if (denied) return denied;
    const body = await c.req.json();
    const today = new Date().toISOString().slice(0, 10);
    return c.json(await submitPayment(repo, c.req.param('id'), { ...body, today }));
  });

  app.delete('/:id', async (c) => {
    if (c.get('role') !== 'admin') return c.json({ error: 'Acesso negado' }, 403);
    await archiveReceipt(repo, c.req.param('id'));
    return c.body(null, 204);
  });

  return app;
}
