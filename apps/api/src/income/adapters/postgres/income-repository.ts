import type { Pool } from 'pg';

import { incomeSchema, type Income } from '../../domain/income';
import type { IncomeRepository } from '../../domain/income-repository';

const INSERT_COLUMNS = 'id, description, source, date, value_cents, proof_data_url';
// DATE comes back as a YYYY-MM-DD string (::text) rather than a JS Date object.
const SELECT_COLUMNS = 'id, description, source, date::text AS date, value_cents, proof_data_url';

interface IncomeRow {
  id: string;
  description: string;
  source: string;
  date: string | null;
  value_cents: number;
  proof_data_url: string | null;
}

function toIncome(row: IncomeRow): Income {
  return incomeSchema.parse({
    id: row.id,
    description: row.description,
    source: row.source,
    date: row.date,
    valueCents: row.value_cents,
    proofDataUrl: row.proof_data_url ?? undefined,
  });
}

export class PostgresIncomeRepository implements IncomeRepository {
  constructor(private readonly pool: Pool) {}

  async list(): Promise<Income[]> {
    const { rows } = await this.pool.query<IncomeRow>(
      `SELECT ${SELECT_COLUMNS} FROM incomes WHERE visible = true ORDER BY date DESC NULLS LAST`,
    );
    return rows.map(toIncome);
  }

  async getById(id: string): Promise<Income | null> {
    const { rows } = await this.pool.query<IncomeRow>(
      `SELECT ${SELECT_COLUMNS} FROM incomes WHERE id = $1 AND visible = true`,
      [id],
    );
    return rows[0] ? toIncome(rows[0]) : null;
  }

  async save(income: Income): Promise<Income> {
    await this.pool.query(
      `INSERT INTO incomes (${INSERT_COLUMNS})
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         description = EXCLUDED.description, source = EXCLUDED.source,
         date = EXCLUDED.date, value_cents = EXCLUDED.value_cents,
         proof_data_url = EXCLUDED.proof_data_url`,
      [
        income.id,
        income.description,
        income.source,
        income.date,
        income.valueCents,
        income.proofDataUrl ?? null,
      ],
    );
    return income;
  }

  async archive(id: string): Promise<void> {
    await this.pool.query('UPDATE incomes SET visible = false WHERE id = $1', [id]);
  }
}
