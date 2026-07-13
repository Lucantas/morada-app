import { createTestDb, type Db } from '../../../platform/db';

import { SqliteDashboardRepository } from './dashboard-repository';

function seedAccount(
  db: Db,
  a: {
    id: string;
    description: string;
    category: string;
    dateLabel: string;
    valueCents: number;
    status: string;
  },
): void {
  db.prepare(
    'INSERT INTO accounts (id, description, category, date_label, value_cents, status) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(a.id, a.description, a.category, a.dateLabel, a.valueCents, a.status);
}

function seedReceipt(db: Db, r: { id: string; valueCents: number; status: string }): void {
  db.prepare(
    'INSERT INTO receipts (id, ref, title, due_label, value_cents, status, resident_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(r.id, '04/2026', 'Taxa', 'venc', r.valueCents, r.status, 'r-1');
}

describe('SqliteDashboardRepository', () => {
  test('derives the balance live from paid accounts and paid receipts', async () => {
    const db = createTestDb();
    seedAccount(db, {
      id: 'a-1',
      description: 'Água',
      category: 'Utilidades',
      dateLabel: '05/04',
      valueCents: 100000,
      status: 'pago',
    });
    seedAccount(db, {
      id: 'a-2',
      description: 'Jardinagem',
      category: 'Serviços',
      dateLabel: '12/04',
      valueCents: 50000,
      status: 'pendente',
    });
    seedReceipt(db, { id: 'rc-1', valueCents: 45000, status: 'pago' });
    seedReceipt(db, { id: 'rc-2', valueCents: 45000, status: 'pago' });
    seedReceipt(db, { id: 'rc-3', valueCents: 45000, status: 'pendente' });

    const summary = await new SqliteDashboardRepository(db).getSummary();

    expect(summary.balance.incomeCents).toBe(90000);
    expect(summary.balance.paidCents).toBe(100000);
    expect(summary.balance.balanceCents).toBe(-10000);
    expect(summary.recentPaid.map((p) => p.id)).toEqual(['a-1']);
  });

  test('returns a zeroed summary for an empty ledger', async () => {
    const summary = await new SqliteDashboardRepository(createTestDb()).getSummary();
    expect(summary.balance).toEqual({ balanceCents: 0, incomeCents: 0, paidCents: 0 });
    expect(summary.recentPaid).toEqual([]);
    expect(summary.maintenances).toEqual([]);
  });
});
