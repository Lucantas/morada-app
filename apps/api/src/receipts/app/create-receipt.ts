import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { ChargeResidentNotFoundError, ReceiptValidationError } from '../domain/errors';
import { receiptSchema, type Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

export type ResidentGuard = (residentId: string) => boolean;

const inputSchema = z.object({
  residentId: z.string().min(1).max(64),
  ref: z.string().min(1).max(40),
  title: z.string().min(1).max(120),
  valueCents: z.number().int().min(0).max(1_000_000_000),
  dueLabel: z.string().min(1).max(60),
});

export function createReceipt(
  repo: ReceiptRepository,
  residentExists: ResidentGuard,
  input: unknown,
): Receipt {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new ReceiptValidationError('Dados da cobrança inválidos');
  if (!residentExists(parsed.data.residentId)) {
    throw new ChargeResidentNotFoundError(parsed.data.residentId);
  }
  const receipt = receiptSchema.parse({ ...parsed.data, id: randomUUID(), status: 'pendente' });
  return repo.save(receipt);
}
