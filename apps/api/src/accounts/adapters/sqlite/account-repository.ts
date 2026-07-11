import type { Db } from '../../../platform/db';
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

function toAccount(row: unknown): Account {
  const r = row as AccountRow;
  return accountSchema.parse({
    id: r.id,
    description: r.description,
    category: r.category,
    dateLabel: r.date_label,
    valueCents: r.value_cents,
    status: r.status,
  });
}

export class SqliteAccountRepository implements AccountRepository {
  constructor(private readonly db: Db) {}

  list(): Account[] {
    const rows = this.db.prepare(`SELECT ${COLUMNS} FROM accounts`).all();
    return rows.map(toAccount);
  }

  getById(id: string): Account | null {
    const row = this.db.prepare(`SELECT ${COLUMNS} FROM accounts WHERE id = ?`).get(id);
    return row ? toAccount(row) : null;
  }

  save(account: Account): Account {
    this.db
      .prepare(
        `INSERT INTO accounts (${COLUMNS})
         VALUES (@id, @description, @category, @dateLabel, @valueCents, @status)
         ON CONFLICT(id) DO UPDATE SET
           description = @description, category = @category, date_label = @dateLabel,
           value_cents = @valueCents, status = @status`,
      )
      .run(account);
    return account;
  }
}
