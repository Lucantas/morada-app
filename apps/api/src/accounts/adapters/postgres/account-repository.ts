import type { Pool } from 'pg';

import { accountSchema, type Account } from '../../domain/account';
import type { AccountRepository } from '../../domain/account-repository';

const COLUMNS = 'id, description, category, date_label, value_cents, status';

interface AccountRow {
  id: string;
  description: string;
  category: string;
  date_label: string;
  value_cents: number;
  status: string;
}

function toAccount(row: AccountRow): Account {
  return accountSchema.parse({
    id: row.id,
    description: row.description,
    category: row.category,
    dateLabel: row.date_label,
    valueCents: row.value_cents,
    status: row.status,
  });
}

export class PostgresAccountRepository implements AccountRepository {
  constructor(private readonly pool: Pool) {}

  async list(): Promise<Account[]> {
    const { rows } = await this.pool.query<AccountRow>(`SELECT ${COLUMNS} FROM accounts`);
    return rows.map(toAccount);
  }

  async getById(id: string): Promise<Account | null> {
    const { rows } = await this.pool.query<AccountRow>(
      `SELECT ${COLUMNS} FROM accounts WHERE id = $1`,
      [id],
    );
    return rows[0] ? toAccount(rows[0]) : null;
  }

  async save(account: Account): Promise<Account> {
    await this.pool.query(
      `INSERT INTO accounts (${COLUMNS})
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         description = EXCLUDED.description, category = EXCLUDED.category,
         date_label = EXCLUDED.date_label, value_cents = EXCLUDED.value_cents,
         status = EXCLUDED.status`,
      [
        account.id,
        account.description,
        account.category,
        account.dateLabel,
        account.valueCents,
        account.status,
      ],
    );
    return account;
  }
}
