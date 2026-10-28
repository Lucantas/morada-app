import type { Pool } from 'pg';

import {
  buildDashboardSummary,
  type OpeningBalance,
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

interface OpeningRow {
  opening_balance_cents: number | null;
  opening_balance_date: string | null;
}

// The summary is derived live from the ledger (accounts = expenses,
// receipts = collected fees) rather than a stored snapshot.
export class PostgresDashboardRepository implements DashboardRepository {
  constructor(
    private readonly pool: Pool,
    private readonly condominiumId: string,
  ) {}

  async getSummary(): Promise<DashboardSummary> {
    const accountsResult = await this.pool.query<AccountRow>(
      'SELECT id, description, category, date::text AS date, value_cents, status, (proof_key IS NOT NULL OR proof_data_url IS NOT NULL) AS has_proof FROM accounts WHERE visible = true AND condominium_id = $1',
      [this.condominiumId],
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
      'SELECT value_cents, status, paid_at::text AS paid_at FROM receipts WHERE visible = true AND condominium_id = $1',
      [this.condominiumId],
    );
    const receipts: LedgerReceipt[] = receiptsResult.rows.map((row) => ({
      valueCents: row.value_cents,
      status: row.status,
      paidAt: row.paid_at,
    }));

    const incomesResult = await this.pool.query<IncomeRow>(
      'SELECT value_cents, date::text AS date FROM incomes WHERE visible = true AND condominium_id = $1',
      [this.condominiumId],
    );
    const incomes: LedgerIncome[] = incomesResult.rows.map((row) => ({
      valueCents: row.value_cents,
      date: row.date,
    }));

    const openingResult = await this.pool.query<OpeningRow>(
      'SELECT opening_balance_cents, opening_balance_date::text AS opening_balance_date FROM condo_settings WHERE condominium_id = $1',
      [this.condominiumId],
    );
    const openingRow = openingResult.rows[0];
    const opening: OpeningBalance | null =
      openingRow !== undefined &&
      openingRow.opening_balance_cents !== null &&
      openingRow.opening_balance_date !== null
        ? { valueCents: openingRow.opening_balance_cents, date: openingRow.opening_balance_date }
        : null;

    const today = new Date().toISOString().slice(0, 10);
    return buildDashboardSummary(accounts, receipts, incomes, today, opening);
  }
}
