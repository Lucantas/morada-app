import type { Pool } from 'pg';

import {
  buildDashboardSummary,
  type LedgerAccount,
  type LedgerIncome,
  type LedgerReceipt,
} from '../../domain/build-dashboard-summary';
import type { DashboardSummary } from '../../domain/dashboard';
import type { DashboardRepository } from '../../domain/dashboard-repository';

interface AccountRow {
  id: string;
  description: string;
  category: string;
  date: string | null;
  value_cents: number;
  status: string;
}

interface ReceiptRow {
  value_cents: number;
  status: string;
  paid_at: string | null;
}

interface IncomeRow {
  value_cents: number;
  date: string | null;
}

// The summary is derived live from the ledger (accounts = expenses,
// receipts = collected fees) rather than a stored snapshot.
export class PostgresDashboardRepository implements DashboardRepository {
  constructor(private readonly pool: Pool) {}

  async getSummary(): Promise<DashboardSummary> {
    const accountsResult = await this.pool.query<AccountRow>(
      'SELECT id, description, category, date::text AS date, value_cents, status FROM accounts',
    );
    const accounts: LedgerAccount[] = accountsResult.rows.map((row) => ({
      id: row.id,
      description: row.description,
      category: row.category,
      date: row.date,
      valueCents: row.value_cents,
      status: row.status,
    }));

    const receiptsResult = await this.pool.query<ReceiptRow>(
      'SELECT value_cents, status, paid_at::text AS paid_at FROM receipts',
    );
    const receipts: LedgerReceipt[] = receiptsResult.rows.map((row) => ({
      valueCents: row.value_cents,
      status: row.status,
      paidAt: row.paid_at,
    }));

    const incomesResult = await this.pool.query<IncomeRow>(
      'SELECT value_cents, date::text AS date FROM incomes',
    );
    const incomes: LedgerIncome[] = incomesResult.rows.map((row) => ({
      valueCents: row.value_cents,
      date: row.date,
    }));

    const today = new Date().toISOString().slice(0, 10);
    return buildDashboardSummary(accounts, receipts, incomes, today);
  }
}
