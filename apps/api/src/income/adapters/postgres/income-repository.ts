import type { Pool } from 'pg';

import {
  decodeDataUrl,
  type ProofBytes,
  type ProofStorage,
} from '../../../receipts/domain/proof-storage';
import { incomeSchema, type Income } from '../../domain/income';
import type { IncomeRepository } from '../../domain/income-repository';

const DATA_URL_PATTERN = /^data:[^;]+;base64,/;

const INSERT_COLUMNS = 'id, description, source, date, value_cents, proof_data_url, proof_key';
// DATE comes back as a YYYY-MM-DD string (::text) rather than a JS Date object.
// proof_data_url/proof_key are intentionally excluded here — reads only need
// whether a proof exists (has_proof); the bytes are served via getProof.
const SELECT_COLUMNS =
  'id, description, source, date::text AS date, value_cents, (proof_key IS NOT NULL OR proof_data_url IS NOT NULL) AS has_proof';

interface IncomeRow {
  id: string;
  description: string;
  source: string;
  date: string | null;
  value_cents: number;
  has_proof: boolean;
}

interface ProofRow {
  proof_key: string | null;
  proof_data_url: string | null;
}

function toIncome(row: IncomeRow): Income {
  return incomeSchema.parse({
    id: row.id,
    description: row.description,
    source: row.source,
    date: row.date,
    valueCents: row.value_cents,
    hasProof: row.has_proof,
  });
}

export class PostgresIncomeRepository implements IncomeRepository {
  constructor(
    private readonly pool: Pool,
    private readonly storage: ProofStorage | null,
  ) {}

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

  async getProof(id: string): Promise<ProofBytes | null> {
    const { rows } = await this.pool.query<ProofRow>(
      'SELECT proof_key, proof_data_url FROM incomes WHERE id = $1 AND visible = true',
      [id],
    );
    const row = rows[0];
    if (!row) return null;
    if (row.proof_key) return (await this.storage?.get(row.proof_key)) ?? null;
    if (row.proof_data_url) return decodeDataUrl(row.proof_data_url);
    return null;
  }

  async save(income: Income): Promise<Income> {
    const touchesProof = income.proofDataUrl !== undefined;
    const isFreshUpload =
      typeof income.proofDataUrl === 'string' && DATA_URL_PATTERN.test(income.proofDataUrl);
    let proofKey: string | null = null;
    let proofDataUrl: string | null = null;
    if (isFreshUpload && this.storage) {
      proofKey = `incomes/${income.id}`;
      await this.storage.put(proofKey, income.proofDataUrl as string);
    } else if (touchesProof) {
      proofDataUrl = income.proofDataUrl ?? null;
    }

    // When the save carries no proof change (proofDataUrl === undefined, e.g.
    // updateIncome re-saving an existing income), the SET clause must not
    // mention the proof columns at all, so an existing row keeps its proof —
    // the INSERT branch still supplies NULL/NULL, correct for a brand-new row.
    const proofSetClause = touchesProof
      ? 'proof_data_url = EXCLUDED.proof_data_url, proof_key = EXCLUDED.proof_key'
      : '';

    const result = await this.pool.query<{ has_proof: boolean }>(
      `INSERT INTO incomes (${INSERT_COLUMNS})
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         description = EXCLUDED.description, source = EXCLUDED.source,
         date = EXCLUDED.date, value_cents = EXCLUDED.value_cents
         ${proofSetClause ? `, ${proofSetClause}` : ''}
       RETURNING (proof_key IS NOT NULL OR proof_data_url IS NOT NULL) AS has_proof`,
      [
        income.id,
        income.description,
        income.source,
        income.date,
        income.valueCents,
        proofDataUrl,
        proofKey,
      ],
    );

    return incomeSchema.parse({
      ...income,
      proofDataUrl: undefined,
      hasProof: result.rows[0]?.has_proof ?? false,
    });
  }

  async archive(id: string): Promise<void> {
    await this.pool.query('UPDATE incomes SET visible = false WHERE id = $1', [id]);
  }
}
