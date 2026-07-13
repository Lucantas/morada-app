import type { Db } from '../../../platform/db';
import {
  buildDashboardSummary,
  type LedgerAccount,
  type LedgerReceipt,
} from '../../domain/build-dashboard-summary';
import type { DashboardSummary } from '../../domain/dashboard';
import type { DashboardRepository } from '../../domain/dashboard-repository';

interface AccountRow {
  id: string;
  description: string;
  category: string;
  date_label: string;
  value_cents: number;
  status: string;
}

interface ReceiptRow {
  value_cents: number;
  status: string;
}

// The summary is derived live from the ledger (accounts = expenses,
// receipts = collected fees) rather than a stored snapshot.
export class SqliteDashboardRepository implements DashboardRepository {
  constructor(private readonly db: Db) {}

  async getSummary(): Promise<DashboardSummary> {
    const accounts: LedgerAccount[] = this.db
      .prepare('SELECT id, description, category, date_label, value_cents, status FROM accounts')
      .all()
      .map((row) => {
        const a = row as AccountRow;
        return {
          id: a.id,
          description: a.description,
          category: a.category,
          dateLabel: a.date_label,
          valueCents: a.value_cents,
          status: a.status,
        };
      });

    const receipts: LedgerReceipt[] = this.db
      .prepare('SELECT value_cents, status FROM receipts')
      .all()
      .map((row) => {
        const r = row as ReceiptRow;
        return { valueCents: r.value_cents, status: r.status };
      });

    return buildDashboardSummary(accounts, receipts);
  }
}
