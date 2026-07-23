import type { Pool } from 'pg';

import { accountSchema, type Account } from '../../domain/account';
import type { AccountRepository } from '../../domain/account-repository';
import type { ProofBytes } from '../../../receipts/domain/proof-storage';

const INSERT_COLUMNS = 'id, description, category, date, value_cents, status';
// DATE comes back as a YYYY-MM-DD string (::text) rather than a JS Date object.
const SELECT_COLUMNS = 'id, description, category, date::text AS date, value_cents, status';

interface AccountRow {
  id: string;
  description: string;
  category: string;
  date: string | null;
  value_cents: number;
  status: string;
}

function toAccount(row: AccountRow): Account {
  return accountSchema.parse({
    id: row.id,
    description: row.description,
    category: row.category,
    date: row.date,
    valueCents: row.value_cents,
    status: row.status,
  });
}

export class PostgresAccountRepository implements AccountRepository {
  constructor(private readonly pool: Pool) {}

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

  async save(account: Account): Promise<Account> {
    await this.pool.query(
      `INSERT INTO accounts (${INSERT_COLUMNS})
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         description = EXCLUDED.description, category = EXCLUDED.category,
         date = EXCLUDED.date, value_cents = EXCLUDED.value_cents,
         status = EXCLUDED.status`,
      [
        account.id,
        account.description,
        account.category,
        account.date,
        account.valueCents,
        account.status,
      ],
    );
    return account;
  }

  async archive(id: string): Promise<void> {
    await this.pool.query('UPDATE accounts SET visible = false WHERE id = $1', [id]);
  }

  async getProof(): Promise<ProofBytes | null> {
    throw new Error('Not implemented');
  }
}
