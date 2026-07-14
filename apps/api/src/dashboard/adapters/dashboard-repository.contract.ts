import type { AccountRepository } from '../../accounts/domain/account-repository';
import type { ReceiptRepository } from '../../receipts/domain/receipt-repository';
import type { DashboardRepository } from '../domain/dashboard-repository';

// The dashboard reads the ledger, so the harness also exposes the account and
// receipt repositories (driver-matched) to seed it through the real adapters.
export interface DashboardHarness {
  dashboard: DashboardRepository;
  accounts: AccountRepository;
  receipts: ReceiptRepository;
}

export function runDashboardRepositoryContract(
  label: string,
  setup: () => Promise<DashboardHarness>,
): void {
  describe(label, () => {
    test('derives the balance live from paid accounts and paid receipts', async () => {
      const { dashboard, accounts, receipts } = await setup();
      await accounts.save({
        id: 'a-1',
        description: 'Água',
        category: 'Utilidades',
        date: '2026-04-05',
        valueCents: 100000,
        status: 'pago',
      });
      await accounts.save({
        id: 'a-2',
        description: 'Jardinagem',
        category: 'Serviços',
        date: '2026-04-12',
        valueCents: 50000,
        status: 'pendente',
      });
      await receipts.save({
        id: 'rc-1',
        ref: '04/2026',
        title: 'Taxa',
        dueDate: '2026-04-10',
        valueCents: 45000,
        status: 'pago',
        residentId: 'r-1',
      });
      await receipts.save({
        id: 'rc-2',
        ref: '04/2026',
        title: 'Taxa',
        dueDate: '2026-04-10',
        valueCents: 45000,
        status: 'pago',
        residentId: 'r-1',
      });
      await receipts.save({
        id: 'rc-3',
        ref: '04/2026',
        title: 'Taxa',
        dueDate: '2026-04-10',
        valueCents: 45000,
        status: 'pendente',
        residentId: 'r-1',
      });

      const summary = await dashboard.getSummary();

      expect(summary.balance.incomeCents).toBe(90000);
      expect(summary.balance.paidCents).toBe(100000);
      expect(summary.balance.balanceCents).toBe(-10000);
      expect(summary.recentPaid.map((p) => p.id)).toEqual(['a-1']);
    });

    test('returns a zeroed summary for an empty ledger', async () => {
      const { dashboard } = await setup();
      const summary = await dashboard.getSummary();
      expect(summary.balance).toEqual({ balanceCents: 0, incomeCents: 0, paidCents: 0 });
      expect(summary.recentPaid).toEqual([]);
      expect(summary.maintenances).toEqual([]);
    });
  });
}
