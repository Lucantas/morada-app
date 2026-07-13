import type { Pool } from 'pg';

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
export class PostgresDashboardRepository implements DashboardRepository {
  constructor(private readonly pool: Pool) {}

  async getSummary(): Promise<DashboardSummary> {
    const accountsResult = await this.pool.query<AccountRow>(
      'SELECT id, description, category, date_label, value_cents, status FROM accounts',
    );
    const accounts: LedgerAccount[] = accountsResult.rows.map((row) => ({
      id: row.id,
      description: row.description,
      category: row.category,
      dateLabel: row.date_label,
      valueCents: row.value_cents,
      status: row.status,
    }));

    const receiptsResult = await this.pool.query<ReceiptRow>(
      'SELECT value_cents, status FROM receipts',
    );
    const receipts: LedgerReceipt[] = receiptsResult.rows.map((row) => ({
      valueCents: row.value_cents,
      status: row.status,
    }));

    return buildDashboardSummary(accounts, receipts);
  }
}
