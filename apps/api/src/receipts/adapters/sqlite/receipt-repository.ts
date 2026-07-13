import type { Db } from '../../../platform/db';
import { receiptSchema, type Receipt } from '../../domain/receipt';
import type { ReceiptRepository } from '../../domain/receipt-repository';

const COLUMNS = 'id, ref, title, due_label, value_cents, status, method, resident_id, apartment_id';

interface ReceiptRow {
  id: unknown;
  ref: unknown;
  title: unknown;
  due_label: unknown;
  value_cents: unknown;
  status: unknown;
  method: unknown;
  resident_id: unknown;
  apartment_id: unknown;
}

function toReceipt(row: unknown): Receipt {
  const { id, ref, title, due_label, value_cents, status, method, resident_id, apartment_id } =
    row as ReceiptRow;
  return receiptSchema.parse({
    id,
    ref,
    title,
    dueLabel: due_label,
    valueCents: value_cents,
    status,
    method: method ?? undefined,
    residentId: resident_id ?? undefined,
    apartmentId: apartment_id ?? undefined,
  });
}

export class SqliteReceiptRepository implements ReceiptRepository {
  constructor(private readonly db: Db) {}

  async list(): Promise<Receipt[]> {
    return this.db.prepare(`SELECT ${COLUMNS} FROM receipts`).all().map(toReceipt);
  }

  async listByResident(residentId: string): Promise<Receipt[]> {
    return this.db
      .prepare(`SELECT ${COLUMNS} FROM receipts WHERE resident_id = ?`)
      .all(residentId)
      .map(toReceipt);
  }

  async listByApartment(apartmentId: string): Promise<Receipt[]> {
    return this.db
      .prepare(`SELECT ${COLUMNS} FROM receipts WHERE apartment_id = ?`)
      .all(apartmentId)
      .map(toReceipt);
  }

  async getById(id: string): Promise<Receipt | null> {
    const row = this.db.prepare(`SELECT ${COLUMNS} FROM receipts WHERE id = ?`).get(id);
    return row ? toReceipt(row) : null;
  }

  async save(receipt: Receipt): Promise<Receipt> {
    this.db
      .prepare(
        `INSERT INTO receipts (${COLUMNS})
         VALUES (@id, @ref, @title, @dueLabel, @valueCents, @status, @method, @residentId, @apartmentId)
         ON CONFLICT(id) DO UPDATE SET
           ref = @ref, title = @title, due_label = @dueLabel,
           value_cents = @valueCents, status = @status, method = @method,
           resident_id = @residentId, apartment_id = @apartmentId`,
      )
      .run({
        ...receipt,
        method: receipt.method ?? null,
        residentId: receipt.residentId ?? null,
        apartmentId: receipt.apartmentId ?? null,
      });
    return receipt;
  }
}
