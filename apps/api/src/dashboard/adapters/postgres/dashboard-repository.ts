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
  has_proof: boolean;
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
      'SELECT id, description, category, date::text AS date, value_cents, status, (proof_key IS NOT NULL OR proof_data_url IS NOT NULL) AS has_proof FROM accounts WHERE visible = true',
    );
    const accounts: LedgerAccount[] = accountsResult.rows.map((row) => ({
      id: row.id,
      description: row.description,
      category: row.category,
      date: row.date,
      valueCents: row.value_cents,
      status: row.status,
      hasProof: row.has_proof,
    }));

    const receiptsResult = await this.pool.query<ReceiptRow>(
      'SELECT value_cents, status, paid_at::text AS paid_at FROM receipts WHERE visible = true',
    );
    const receipts: LedgerReceipt[] = receiptsResult.rows.map((row) => ({
      valueCents: row.value_cents,
      status: row.status,
      paidAt: row.paid_at,
    }));

    const incomesResult = await this.pool.query<IncomeRow>(
      'SELECT value_cents, date::text AS date FROM incomes WHERE visible = true',
    );
    const incomes: LedgerIncome[] = incomesResult.rows.map((row) => ({
      valueCents: row.value_cents,
      date: row.date,
    }));

    const today = new Date().toISOString().slice(0, 10);
    return buildDashboardSummary(accounts, receipts, incomes, today);
  }
}
