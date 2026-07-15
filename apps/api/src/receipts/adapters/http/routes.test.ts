import { Hono } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import type { Receipt } from '../../domain/receipt';
import type { ReceiptRepository } from '../../domain/receipt-repository';

import { receiptRoutes } from './routes';

function fakeRepo(list: Receipt[]): ReceiptRepository {
  const map = new Map(list.map((r) => [r.id, r]));
  return {
    list: async () => [...map.values()],
    listByResident: async (rid) => [...map.values()].filter((r) => r.residentId === rid),
    listByApartment: async (aid) => [...map.values()].filter((r) => r.apartmentId === aid),
    getById: async (id) => map.get(id) ?? null,
    save: async (r) => {
      map.set(r.id, r);
      return r;
    },
  };
}

const pending: Receipt = {
  id: 'r-1',
  ref: '2024-01',
  title: 'Boleto',
  dueDate: '2026-05-10',
  valueCents: 1000,
  status: 'pendente',
  residentId: 'r-1',
};

function mount(repo: ReceiptRepository, role?: 'admin' | 'resident', sub = 'r-1'): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>();
  app.use('*', async (c, next) => {
    if (role) c.set('role', role);
    c.set('sub', sub);
    await next();
  });
  app.route('/receipts', receiptRoutes(repo));
  return app;
}

describe('receiptRoutes', () => {
  test('GET / lists receipts', async () => {
    const res = await mount(fakeRepo([pending])).request('/receipts');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Receipt[];
    expect(body).toHaveLength(1);
    expect(body[0]?.id).toBe('r-1');
  });

  test('POST /:id/pay flips the status to pago (admin only)', async () => {
    const res = await mount(fakeRepo([pending]), 'admin').request('/receipts/r-1/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'pix' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Receipt;
    expect(body.status).toBe('pago');
    expect(body.method).toBe('pix');
  });

  test('POST /:id/pay rejects a non-admin caller with 403', async () => {
    const res = await mount(fakeRepo([pending]), 'resident').request('/receipts/r-1/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'pix' }),
    });
    expect(res.status).toBe(403);
  });

  test('POST /:id/submit-payment moves the receipt to em_analise', async () => {
    const res = await mount(fakeRepo([pending]), 'resident').request(
      '/receipts/r-1/submit-payment',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'pix',
          proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
        }),
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Receipt;
    expect(body.status).toBe('em_analise');
    expect(body.method).toBe('pix');
    expect(body.submittedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
