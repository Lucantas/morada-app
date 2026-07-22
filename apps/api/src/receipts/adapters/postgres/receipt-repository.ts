import type { Pool } from 'pg';

import { MonthlyReceiptExistsError } from '../../domain/errors';
import { decodeDataUrl, type ProofBytes, type ProofStorage } from '../../domain/proof-storage';
import { receiptSchema, type Receipt } from '../../domain/receipt';
import type { ReceiptRepository } from '../../domain/receipt-repository';

const DATA_URL_PATTERN = /^data:[^;]+;base64,/;

const INSERT_COLUMNS =
  'id, ref, title, due_date, paid_at, value_cents, status, method, resident_id, apartment_id, submitted_at, proof_data_url, proof_key';
// DATE columns come back as YYYY-MM-DD strings (::text) rather than JS Date objects.
// proof_data_url/proof_key are intentionally excluded here — reads only need
// whether a proof exists (has_proof); the bytes are served via getProof.
const SELECT_COLUMNS =
  'id, ref, title, due_date::text AS due_date, paid_at::text AS paid_at, value_cents, status, method, resident_id, apartment_id, submitted_at::text AS submitted_at, (proof_key IS NOT NULL OR proof_data_url IS NOT NULL) AS has_proof';

interface ReceiptRow {
  id: string;
  ref: string;
  title: string;
  due_date: string | null;
  paid_at: string | null;
  value_cents: number;
  status: string;
  method: string | null;
  resident_id: string | null;
  apartment_id: string | null;
  submitted_at: string | null;
  has_proof: boolean;
}

interface ProofRow {
  proof_key: string | null;
  proof_data_url: string | null;
}

function toReceipt(row: ReceiptRow): Receipt {
  return receiptSchema.parse({
    id: row.id,
    ref: row.ref,
    title: row.title,
    dueDate: row.due_date,
    paidAt: row.paid_at ?? undefined,
    valueCents: row.value_cents,
    status: row.status,
    method: row.method ?? undefined,
    residentId: row.resident_id ?? undefined,
    apartmentId: row.apartment_id ?? undefined,
    ...(row.submitted_at ? { submittedAt: row.submitted_at } : {}),
    hasProof: row.has_proof,
  });
}

export class PostgresReceiptRepository implements ReceiptRepository {
  constructor(
    private readonly pool: Pool,
    private readonly storage: ProofStorage | null,
  ) {}

  async list(): Promise<Receipt[]> {
    const { rows } = await this.pool.query<ReceiptRow>(
      `SELECT ${SELECT_COLUMNS} FROM receipts WHERE visible = true`,
    );
    return rows.map(toReceipt);
  }

  async listByResident(residentId: string): Promise<Receipt[]> {
    const { rows } = await this.pool.query<ReceiptRow>(
      `SELECT ${SELECT_COLUMNS} FROM receipts WHERE resident_id = $1 AND visible = true`,
      [residentId],
    );
    return rows.map(toReceipt);
  }

  async listByApartment(apartmentId: string): Promise<Receipt[]> {
    const { rows } = await this.pool.query<ReceiptRow>(
      `SELECT ${SELECT_COLUMNS} FROM receipts WHERE apartment_id = $1 AND visible = true`,
      [apartmentId],
    );
    return rows.map(toReceipt);
  }

  async getById(id: string): Promise<Receipt | null> {
    const { rows } = await this.pool.query<ReceiptRow>(
      `SELECT ${SELECT_COLUMNS} FROM receipts WHERE id = $1 AND visible = true`,
      [id],
    );
    return rows[0] ? toReceipt(rows[0]) : null;
  }

  async getProof(id: string): Promise<ProofBytes | null> {
    const { rows } = await this.pool.query<ProofRow>(
      'SELECT proof_key, proof_data_url FROM receipts WHERE id = $1 AND visible = true',
      [id],
    );
    const row = rows[0];
    if (!row) return null;
    if (row.proof_key) return (await this.storage?.get(row.proof_key)) ?? null;
    if (row.proof_data_url) return decodeDataUrl(row.proof_data_url);
    return null;
  }

  async save(receipt: Receipt): Promise<Receipt> {
    const isFreshUpload =
      receipt.proofDataUrl !== undefined && DATA_URL_PATTERN.test(receipt.proofDataUrl);
    let proofKey: string | null = null;
    let proofDataUrl: string | null = null;
    if (isFreshUpload && this.storage) {
      proofKey = `receipts/${receipt.id}`;
      await this.storage.put(proofKey, receipt.proofDataUrl as string);
    } else {
      proofDataUrl = receipt.proofDataUrl ?? null;
    }

    try {
      await this.pool.query(
        `INSERT INTO receipts (${INSERT_COLUMNS})
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET
           ref = EXCLUDED.ref, title = EXCLUDED.title, due_date = EXCLUDED.due_date,
           paid_at = EXCLUDED.paid_at, value_cents = EXCLUDED.value_cents, status = EXCLUDED.status,
           method = EXCLUDED.method, resident_id = EXCLUDED.resident_id,
           apartment_id = EXCLUDED.apartment_id, submitted_at = EXCLUDED.submitted_at,
           proof_data_url = EXCLUDED.proof_data_url, proof_key = EXCLUDED.proof_key`,
        [
          receipt.id,
          receipt.ref,
          receipt.title,
          receipt.dueDate,
          receipt.paidAt ?? null,
          receipt.valueCents,
          receipt.status,
          receipt.method ?? null,
          receipt.residentId ?? null,
          receipt.apartmentId ?? null,
          receipt.submittedAt ?? null,
          proofDataUrl,
          proofKey,
        ],
      );
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === '23505' &&
        'constraint' in error &&
        error.constraint === 'idx_receipts_condo_fee_month'
      ) {
        throw new MonthlyReceiptExistsError();
      }
      throw error;
    }
    return receiptSchema.parse({
      ...receipt,
      proofDataUrl: undefined,
      hasProof: proofKey !== null || proofDataUrl !== null,
    });
  }

  async archive(id: string): Promise<void> {
    await this.pool.query('UPDATE receipts SET visible = false WHERE id = $1', [id]);
  }
}
