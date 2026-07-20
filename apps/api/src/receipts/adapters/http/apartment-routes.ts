import { Hono } from 'hono';

import { requireRole, type ApiEnv } from '../../../platform/auth';
import { listApartmentReceipts } from '../../app/list-apartment-receipts';
import type { ReceiptRepository } from '../../domain/receipt-repository';

interface ApartmentReceiptRoutesDeps {
  receipts: ReceiptRepository;
}

export function apartmentReceiptRoutes({ receipts }: ApartmentReceiptRoutesDeps) {
  const app = new Hono<ApiEnv>();

  // Admin: an apartment's full receipt ledger, across every resident who has
  // occupied it (the resident-facing view stays scoped to their own receipts).
  app.get('/:id/receipts', requireRole('admin'), async (c) =>
    c.json(await listApartmentReceipts(receipts, c.req.param('id'))),
  );

  return app;
}
