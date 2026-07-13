import {
  buildDashboardSummary,
  type LedgerAccount,
  type LedgerReceipt,
} from './build-dashboard-summary';

const accounts: LedgerAccount[] = [
  {
    id: 'a-1',
    description: 'Água — abril',
    category: 'Utilidades',
    dateLabel: '05/04',
    valueCents: 124000,
    status: 'pago',
  },
  {
    id: 'a-2',
    description: 'Energia — áreas comuns',
    category: 'Utilidades',
    dateLabel: '03/04',
    valueCents: 89000,
    status: 'pago',
  },
  {
    id: 'a-3',
    description: 'Limpeza',
    category: 'Serviços',
    dateLabel: '02/04',
    valueCents: 150000,
    status: 'pago',
  },
  {
    id: 'a-4',
    description: 'Jardinagem',
    category: 'Serviços',
    dateLabel: '12/04',
    valueCents: 45000,
    status: 'pendente',
  },
  {
    id: 'a-5',
    description: 'Reparo portão',
    category: 'Manutenção',
    dateLabel: '15/04',
    valueCents: 30000,
    status: 'atrasado',
  },
];

const receipts: LedgerReceipt[] = [
  { valueCents: 45000, status: 'pago' },
  { valueCents: 45000, status: 'pago' },
  { valueCents: 45000, status: 'pendente' },
];

describe('buildDashboardSummary', () => {
  test('income is the sum of paid receipts', () => {
    expect(buildDashboardSummary(accounts, receipts).balance.incomeCents).toBe(90000);
  });

  test('paid is the sum of paid accounts (expenses)', () => {
    expect(buildDashboardSummary(accounts, receipts).balance.paidCents).toBe(363000);
  });

  test('balance is income minus paid expenses', () => {
    expect(buildDashboardSummary(accounts, receipts).balance.balanceCents).toBe(90000 - 363000);
  });

  test('recentPaid lists paid accounts newest-first, capped at four', () => {
    const { recentPaid } = buildDashboardSummary(accounts, receipts);
    expect(recentPaid.map((p) => p.id)).toEqual(['a-1', 'a-2', 'a-3']);
    expect(recentPaid[0]).toMatchObject({
      label: 'Água — abril',
      dateLabel: 'Paga em 05/04',
      icon: 'water',
    });
    expect(recentPaid[1]?.icon).toBe('bolt');
  });

  test('maintenances come from Manutenção-category accounts', () => {
    const { maintenances } = buildDashboardSummary(accounts, receipts);
    expect(maintenances).toHaveLength(1);
    expect(maintenances[0]).toMatchObject({
      title: 'Reparo portão',
      detail: 'Atrasado · 15/04',
      icon: 'wrench',
    });
  });

  test('handles an empty ledger', () => {
    const summary = buildDashboardSummary([], []);
    expect(summary.balance).toEqual({ balanceCents: 0, incomeCents: 0, paidCents: 0 });
    expect(summary.recentPaid).toEqual([]);
    expect(summary.maintenances).toEqual([]);
  });
});
