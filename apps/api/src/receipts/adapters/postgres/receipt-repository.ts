import type { Pool } from 'pg';

import { receiptSchema, type Receipt } from '../../domain/receipt';
import type { ReceiptRepository } from '../../domain/receipt-repository';

const COLUMNS = 'id, ref, title, due_label, value_cents, status, method, resident_id, apartment_id';

interface ReceiptRow {
  id: string;
  ref: string;
  title: string;
  due_label: string;
  value_cents: number;
  status: string;
  method: string | null;
  resident_id: string | null;
  apartment_id: string | null;
}

function toReceipt(row: ReceiptRow): Receipt {
  return receiptSchema.parse({
    id: row.id,
    ref: row.ref,
    title: row.title,
    dueLabel: row.due_label,
    valueCents: row.value_cents,
    status: row.status,
    method: row.method ?? undefined,
    residentId: row.resident_id ?? undefined,
    apartmentId: row.apartment_id ?? undefined,
  });
}

export class PostgresReceiptRepository implements ReceiptRepository {
  constructor(private readonly pool: Pool) {}

  async list(): Promise<Receipt[]> {
    const { rows } = await this.pool.query<ReceiptRow>(`SELECT ${COLUMNS} FROM receipts`);
    return rows.map(toReceipt);
  }

  async listByResident(residentId: string): Promise<Receipt[]> {
    const { rows } = await this.pool.query<ReceiptRow>(
      `SELECT ${COLUMNS} FROM receipts WHERE resident_id = $1`,
      [residentId],
    );
    return rows.map(toReceipt);
  }

  async listByApartment(apartmentId: string): Promise<Receipt[]> {
    const { rows } = await this.pool.query<ReceiptRow>(
      `SELECT ${COLUMNS} FROM receipts WHERE apartment_id = $1`,
      [apartmentId],
    );
    return rows.map(toReceipt);
  }

  async getById(id: string): Promise<Receipt | null> {
    const { rows } = await this.pool.query<ReceiptRow>(
      `SELECT ${COLUMNS} FROM receipts WHERE id = $1`,
      [id],
    );
    return rows[0] ? toReceipt(rows[0]) : null;
  }

  async save(receipt: Receipt): Promise<Receipt> {
    await this.pool.query(
      `INSERT INTO receipts (${COLUMNS})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         ref = EXCLUDED.ref, title = EXCLUDED.title, due_label = EXCLUDED.due_label,
         value_cents = EXCLUDED.value_cents, status = EXCLUDED.status, method = EXCLUDED.method,
         resident_id = EXCLUDED.resident_id, apartment_id = EXCLUDED.apartment_id`,
      [
        receipt.id,
        receipt.ref,
        receipt.title,
        receipt.dueLabel,
        receipt.valueCents,
        receipt.status,
        receipt.method ?? null,
        receipt.residentId ?? null,
        receipt.apartmentId ?? null,
      ],
    );
    return receipt;
  }
}
