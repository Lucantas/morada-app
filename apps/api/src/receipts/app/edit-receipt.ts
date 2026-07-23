import { z } from 'zod';

import { ReceiptNotFoundError, ReceiptValidationError } from '../domain/errors';
import { isoDateSchema, receiptSchema, type Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

const patchSchema = z.object({
  ref: z.string().min(1).max(40),
  title: z.string().min(1).max(120),
  valueCents: z.number().int().min(0).max(1_000_000_000),
  dueDate: isoDateSchema,
  paidAt: isoDateSchema.optional(),
});

export async function editReceipt(
  repo: ReceiptRepository,
  id: string,
  input: unknown,
): Promise<Receipt> {
  const parsed = patchSchema.safeParse(input);
  if (!parsed.success) throw new ReceiptValidationError('Dados do recibo inválidos');
  const existing = await repo.getById(id);
  if (!existing) throw new ReceiptNotFoundError(id);
  const updated = receiptSchema.parse({ ...existing, ...parsed.data });
  return repo.save(updated);
}
