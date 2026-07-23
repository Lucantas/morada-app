import type { Pool } from 'pg';

import {
  decodeDataUrl,
  type ProofBytes,
  type ProofStorage,
} from '../../../receipts/domain/proof-storage';
import { accountSchema, type Account } from '../../domain/account';
import type { AccountRepository } from '../../domain/account-repository';

const DATA_URL_PATTERN = /^data:[^;]+;base64,/;

const INSERT_COLUMNS =
  'id, description, category, date, value_cents, status, proof_data_url, proof_key';
// DATE comes back as a YYYY-MM-DD string (::text). proof_* excluded from reads —
// reads only need whether a proof exists (has_proof); bytes are served via getProof.
const SELECT_COLUMNS =
  'id, description, category, date::text AS date, value_cents, status, (proof_key IS NOT NULL OR proof_data_url IS NOT NULL) AS has_proof';

interface AccountRow {
  id: string;
  description: string;
  category: string;
  date: string | null;
  value_cents: number;
  status: string;
  has_proof: boolean;
}

interface ProofRow {
  proof_key: string | null;
  proof_data_url: string | null;
}

function toAccount(row: AccountRow): Account {
  return accountSchema.parse({
    id: row.id,
    description: row.description,
    category: row.category,
    date: row.date,
    valueCents: row.value_cents,
    status: row.status,
    hasProof: row.has_proof,
  });
}

export class PostgresAccountRepository implements AccountRepository {
  constructor(
    private readonly pool: Pool,
    private readonly storage: ProofStorage | null,
  ) {}

  async list(): Promise<Account[]> {
    const { rows } = await this.pool.query<AccountRow>(
      `SELECT ${SELECT_COLUMNS} FROM accounts WHERE visible = true`,
    );
    return rows.map(toAccount);
  }

  async getById(id: string): Promise<Account | null> {
    const { rows } = await this.pool.query<AccountRow>(
      `SELECT ${SELECT_COLUMNS} FROM accounts WHERE id = $1 AND visible = true`,
      [id],
    );
    return rows[0] ? toAccount(rows[0]) : null;
  }

  async getProof(id: string): Promise<ProofBytes | null> {
    const { rows } = await this.pool.query<ProofRow>(
      'SELECT proof_key, proof_data_url FROM accounts WHERE id = $1 AND visible = true',
      [id],
    );
    const row = rows[0];
    if (!row) return null;
    if (row.proof_key) return (await this.storage?.get(row.proof_key)) ?? null;
    if (row.proof_data_url) return decodeDataUrl(row.proof_data_url);
    return null;
  }

  async save(account: Account): Promise<Account> {
    const touchesProof = account.proofDataUrl !== undefined;
    const isFreshUpload =
      typeof account.proofDataUrl === 'string' && DATA_URL_PATTERN.test(account.proofDataUrl);
    let proofKey: string | null = null;
    let proofDataUrl: string | null = null;
    if (isFreshUpload && this.storage) {
      proofKey = `accounts/${account.id}`;
      await this.storage.put(proofKey, account.proofDataUrl as string);
    } else if (touchesProof) {
      proofDataUrl = account.proofDataUrl ?? null;
    }

    const proofSetClause = touchesProof
      ? ', proof_data_url = EXCLUDED.proof_data_url, proof_key = EXCLUDED.proof_key'
      : '';

    const result = await this.pool.query<{ has_proof: boolean }>(
      `INSERT INTO accounts (${INSERT_COLUMNS})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         description = EXCLUDED.description, category = EXCLUDED.category,
         date = EXCLUDED.date, value_cents = EXCLUDED.value_cents,
         status = EXCLUDED.status${proofSetClause}
       RETURNING (proof_key IS NOT NULL OR proof_data_url IS NOT NULL) AS has_proof`,
      [
        account.id,
        account.description,
        account.category,
        account.date,
        account.valueCents,
        account.status,
        proofDataUrl,
        proofKey,
      ],
    );

    return accountSchema.parse({
      ...account,
      proofDataUrl: undefined,
      hasProof: result.rows[0]?.has_proof ?? false,
    });
  }

  async archive(id: string): Promise<void> {
    await this.pool.query('UPDATE accounts SET visible = false WHERE id = $1', [id]);
  }
}
