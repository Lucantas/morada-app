import {
  buildDashboardSummary,
  type LedgerAccount,
  type LedgerIncome,
  type LedgerReceipt,
} from './build-dashboard-summary';

const TODAY = '2026-04-14';

const accounts: LedgerAccount[] = [
  {
    id: 'a-1',
    description: 'Água — abril',
    category: 'Utilidades',
    date: '2026-04-05',
    valueCents: 124000,
    status: 'pago',
  },
  {
    id: 'a-2',
    description: 'Energia — áreas comuns',
    category: 'Utilidades',
    date: '2026-04-03',
    valueCents: 89000,
    status: 'pago',
  },
  {
    id: 'a-3',
    description: 'Limpeza',
    category: 'Serviços',
    date: '2026-04-02',
    valueCents: 150000,
    status: 'pago',
  },
  {
    id: 'a-4',
    description: 'Jardinagem',
    category: 'Serviços',
    date: '2026-04-12',
    valueCents: 45000,
    status: 'pendente',
  },
  {
    id: 'a-5',
    description: 'Reparo portão',
    category: 'Manutenção',
    date: '2026-04-15',
    valueCents: 30000,
    status: 'atrasado',
  },
];

const receipts: LedgerReceipt[] = [
  { valueCents: 45000, status: 'pago', paidAt: '2026-04-01' },
  { valueCents: 45000, status: 'pago', paidAt: '2026-04-02' },
  { valueCents: 45000, status: 'pendente', paidAt: null },
];

const incomes: LedgerIncome[] = [
  { valueCents: 10000, date: '2026-04-10' }, // this month
  { valueCents: 5000, date: '2026-01-02' }, // earlier — all-time only
  { valueCents: 2000, date: null }, // undated — all-time only
];

describe('buildDashboardSummary', () => {
  test('income is the sum of this month paid receipts', () => {
    expect(buildDashboardSummary(accounts, receipts, [], TODAY).balance.incomeCents).toBe(90000);
  });

  test('paid is the sum of this month paid accounts (expenses)', () => {
    expect(buildDashboardSummary(accounts, receipts, [], TODAY).balance.paidCents).toBe(363000);
  });

  test('balance is all-time income minus all-time paid expenses', () => {
    expect(buildDashboardSummary(accounts, receipts, [], TODAY).balance.balanceCents).toBe(
      90000 - 363000,
    );
  });

  test('income of the month adds paid receipts and this-month incomes', () => {
    expect(buildDashboardSummary(accounts, receipts, incomes, TODAY).balance.incomeCents).toBe(
      100000,
    );
  });

  test('balance adds all-time incomes to all-time paid receipts, minus paid expenses', () => {
    expect(buildDashboardSummary(accounts, receipts, incomes, TODAY).balance.balanceCents).toBe(
      90000 + 17000 - 363000,
    );
  });

  test('recentPaid lists paid accounts newest-first, capped at four', () => {
    const { recentPaid } = buildDashboardSummary(accounts, receipts, [], TODAY);
    expect(recentPaid.map((p) => p.id)).toEqual(['a-1', 'a-2', 'a-3']);
    expect(recentPaid[0]).toMatchObject({
      label: 'Água — abril',
      dateLabel: 'Paga em 05/04/2026',
      icon: 'water',
    });
    expect(recentPaid[1]?.icon).toBe('bolt');
  });

  test('maintenances come from Manutenção-category accounts', () => {
    const { maintenances } = buildDashboardSummary(accounts, receipts, [], TODAY);
    expect(maintenances).toHaveLength(1);
    expect(maintenances[0]).toMatchObject({
      title: 'Reparo portão',
      detail: 'Atrasado · 15/04/2026',
      icon: 'wrench',
    });
  });

  test('maintenances are ordered newest-first', () => {
    const withManyMaintenances: LedgerAccount[] = [
      {
        id: 'm-1',
        description: 'Antiga',
        category: 'Manutenção',
        date: '2026-02-10',
        valueCents: 1000,
        status: 'pago',
      },
      {
        id: 'm-2',
        description: 'Nova',
        category: 'Manutenção',
        date: '2026-05-20',
        valueCents: 1000,
        status: 'pago',
      },
      {
        id: 'm-3',
        description: 'Média',
        category: 'Manutenção',
        date: '2026-03-15',
        valueCents: 1000,
        status: 'pago',
      },
    ];

    const { maintenances } = buildDashboardSummary(withManyMaintenances, [], [], TODAY);

    expect(maintenances.map((m) => m.id)).toEqual(['m-2', 'm-3', 'm-1']);
  });

  test('paid accounts and maintenances without a date omit it gracefully', () => {
    const summary = buildDashboardSummary(
      [
        {
          id: 'a-x',
          description: 'Reparo sem data',
          category: 'Manutenção',
          date: null,
          valueCents: 1000,
          status: 'pago',
        },
      ],
      [],
      [],
      TODAY,
    );
    expect(summary.recentPaid[0]?.dateLabel).toBe('Paga');
    expect(summary.maintenances[0]?.detail).toBe('Pago');
  });

  test('handles an empty ledger', () => {
    const summary = buildDashboardSummary([], [], [], TODAY);
    expect(summary.balance).toEqual({ balanceCents: 0, incomeCents: 0, paidCents: 0 });
    expect(summary.recentPaid).toEqual([]);
    expect(summary.maintenances).toEqual([]);
  });
});

describe('buildDashboardSummary — month-aware balance', () => {
  it('balance is all-time; income and paid are current-month only', () => {
    const monthAccounts = [
      {
        id: 'a1',
        description: 'Água',
        category: 'Utilidades',
        date: '2026-07-05',
        valueCents: 8000,
        status: 'pago',
      },
      {
        id: 'a2',
        description: 'Energia',
        category: 'Utilidades',
        date: '2026-06-30',
        valueCents: 5000,
        status: 'pago',
      },
      {
        id: 'a3',
        description: 'Reforma',
        category: 'Obras',
        date: '2026-07-10',
        valueCents: 3000,
        status: 'pendente',
      },
    ];
    const monthReceipts = [
      { valueCents: 15000, status: 'pago', paidAt: '2026-07-02' },
      { valueCents: 15000, status: 'pago', paidAt: '2026-06-20' },
      { valueCents: 15000, status: 'pendente', paidAt: null },
    ];

    const summary = buildDashboardSummary(monthAccounts, monthReceipts, [], '2026-07-14');

    expect(summary.balance.balanceCents).toBe(17000);
    expect(summary.balance.incomeCents).toBe(15000);
    expect(summary.balance.paidCents).toBe(8000);
  });
});
