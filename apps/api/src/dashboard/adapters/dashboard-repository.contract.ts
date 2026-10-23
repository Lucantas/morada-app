import type { AccountRepository } from '../../accounts/domain/account-repository';
import type { IncomeRepository } from '../../income/domain/income-repository';
import type { ReceiptRepository } from '../../receipts/domain/receipt-repository';
import type { DashboardRepository } from '../domain/dashboard-repository';

// The dashboard reads the ledger, so the harness also exposes the account,
// receipt, and income repositories (driver-matched) to seed it through the
// real adapters.
export interface DashboardHarness {
  dashboard: DashboardRepository;
  accounts: AccountRepository;
  receipts: ReceiptRepository;
  incomes: IncomeRepository;
}

function previousMonthDate(today: string): string {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const isJanuary = month === 1;
  const previousYear = isJanuary ? year - 1 : year;
  const previousMonth = isJanuary ? 12 : month - 1;
  return `${previousYear}-${String(previousMonth).padStart(2, '0')}-15`;
}

function monthYearRef(isoDate: string): string {
  const year = isoDate.slice(0, 4);
  const month = isoDate.slice(5, 7);
  return `${month}/${year}`;
}

export function runDashboardRepositoryContract(
  label: string,
  setup: (condominiumId: string) => Promise<DashboardHarness>,
): void {
  describe(label, () => {
    test('derives the balance live from paid accounts, paid receipts, and incomes', async () => {
      const { dashboard, accounts, receipts, incomes } = await setup('condo-a');
      const today = new Date().toISOString().slice(0, 10);
      const thisMonth = today.slice(0, 7);
      const previousMonth = previousMonthDate(today);
      await accounts.save({
        id: 'a-1',
        description: 'Água',
        category: 'Utilidades',
        date: `${thisMonth}-05`,
        valueCents: 100000,
        status: 'pago',
      });
      await accounts.save({
        id: 'a-2',
        description: 'Jardinagem',
        category: 'Serviços',
        date: `${thisMonth}-12`,
        valueCents: 50000,
        status: 'pendente',
      });
      await receipts.save({
        id: 'rc-1',
        ref: '04/2026',
        title: 'Taxa',
        dueDate: `${thisMonth}-10`,
        paidAt: `${thisMonth}-10`,
        valueCents: 45000,
        status: 'pago',
        residentId: 'r-1',
      });
      await receipts.save({
        id: 'rc-2',
        ref: '04/2026',
        title: 'Taxa',
        dueDate: `${thisMonth}-10`,
        paidAt: `${thisMonth}-11`,
        valueCents: 45000,
        status: 'pago',
        residentId: 'r-1',
      });
      await receipts.save({
        id: 'rc-3',
        ref: '04/2026',
        title: 'Taxa',
        dueDate: `${thisMonth}-10`,
        valueCents: 45000,
        status: 'pendente',
        residentId: 'r-1',
      });
      await accounts.save({
        id: 'a-3',
        description: 'Energia',
        category: 'Utilidades',
        date: previousMonth,
        valueCents: 30000,
        status: 'pago',
      });
      await receipts.save({
        id: 'rc-4',
        ref: monthYearRef(previousMonth),
        title: 'Taxa',
        dueDate: previousMonth,
        paidAt: previousMonth,
        valueCents: 20000,
        status: 'pago',
        residentId: 'r-1',
      });
      await incomes.save({
        id: 'i-1',
        description: 'Aluguel salão de festas',
        source: 'Salão de festas',
        date: `${thisMonth}-08`,
        valueCents: 10000,
      });

      const summary = await dashboard.getSummary();

      expect(summary.balance.incomeCents).toBe(100000);
      expect(summary.balance.paidCents).toBe(100000);
      expect(summary.balance.balanceCents).toBe(-10000);
      expect(summary.recentPaid.map((p) => p.id)).toEqual(['a-1', 'a-3']);
    });

    test('returns a zeroed summary for an empty ledger', async () => {
      const { dashboard } = await setup('condo-a');
      const summary = await dashboard.getSummary();
      expect(summary.balance).toEqual({ balanceCents: 0, incomeCents: 0, paidCents: 0 });
      expect(summary.recentPaid).toEqual([]);
      expect(summary.maintenances).toEqual([]);
    });

    test('an archived income is not counted in the summary', async () => {
      const { dashboard, incomes } = await setup('condo-a');
      const today = new Date().toISOString().slice(0, 10);
      const thisMonth = today.slice(0, 7);
      await incomes.save({
        id: 'i-1',
        description: 'Aluguel salão de festas',
        source: 'Salão de festas',
        date: `${thisMonth}-08`,
        valueCents: 10000,
      });

      await incomes.archive('i-1');
      const summary = await dashboard.getSummary();

      expect(summary.balance.incomeCents).toBe(0);
      expect(summary.balance.balanceCents).toBe(0);
    });

    test("summary ignores other condos' receipts, accounts and incomes", async () => {
      const a = await setup('condo-a');
      const b = await setup('condo-b');
      const thisMonth = new Date().toISOString().slice(0, 7);
      await b.accounts.save({
        id: 'b-acc',
        description: 'Água',
        category: 'Utilidades',
        date: `${thisMonth}-05`,
        valueCents: 70000,
        status: 'pago',
      });
      await b.receipts.save({
        id: 'b-rc',
        ref: '04/2026',
        title: 'Taxa',
        dueDate: `${thisMonth}-10`,
        paidAt: `${thisMonth}-10`,
        valueCents: 45000,
        status: 'pago',
        residentId: 'r-b',
      });
      await b.incomes.save({
        id: 'b-in',
        description: 'Salão',
        source: 'Salão de festas',
        date: `${thisMonth}-08`,
        valueCents: 10000,
      });

      const summaryA = await a.dashboard.getSummary();
      const summaryB = await b.dashboard.getSummary();

      expect(summaryA.balance).toEqual({ balanceCents: 0, incomeCents: 0, paidCents: 0 });
      expect(summaryA.recentPaid).toEqual([]);
      expect(summaryB.balance.paidCents).toBe(70000);
      expect(summaryB.recentPaid.map((p) => p.id)).toEqual(['b-acc']);
    });
  });
}
