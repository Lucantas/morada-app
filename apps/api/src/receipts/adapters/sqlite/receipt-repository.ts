import type { Db } from '../../../platform/db';
import { receiptSchema, type Receipt } from '../../domain/receipt';
import type { ReceiptRepository } from '../../domain/receipt-repository';

const COLUMNS = 'id, ref, title, due_label, value_cents, status, method';

interface ReceiptRow {
  id: unknown;
  ref: unknown;
  title: unknown;
  due_label: unknown;
  value_cents: unknown;
  status: unknown;
  method: unknown;
}

function toReceipt(row: unknown): Receipt {
  const { id, ref, title, due_label, value_cents, status, method } = row as ReceiptRow;
  return receiptSchema.parse({
    id,
    ref,
    title,
    dueLabel: due_label,
    valueCents: value_cents,
    status,
    method: method ?? undefined,
  });
}

export class SqliteReceiptRepository implements ReceiptRepository {
  constructor(private readonly db: Db) {}

  list(): Receipt[] {
    const rows = this.db.prepare(`SELECT ${COLUMNS} FROM receipts`).all();
    return rows.map(toReceipt);
  }

  getById(id: string): Receipt | null {
    const row = this.db.prepare(`SELECT ${COLUMNS} FROM receipts WHERE id = ?`).get(id);
    return row ? toReceipt(row) : null;
  }

  save(receipt: Receipt): Receipt {
    this.db
      .prepare(
        `INSERT INTO receipts (${COLUMNS})
         VALUES (@id, @ref, @title, @dueLabel, @valueCents, @status, @method)
         ON CONFLICT(id) DO UPDATE SET
           ref = @ref, title = @title, due_label = @dueLabel,
           value_cents = @valueCents, status = @status, method = @method`,
      )
      .run({ ...receipt, method: receipt.method ?? null });
    return receipt;
  }
}
