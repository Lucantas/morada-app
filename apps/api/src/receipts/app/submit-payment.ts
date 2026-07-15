import { z } from 'zod';

import { ReceiptNotFoundError, ReceiptValidationError } from '../domain/errors';
import { receiptMethodSchema, receiptSchema, type Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

const proofSchema = z
  .string()
  .regex(/^data:(image\/[a-z0-9.+-]+|application\/pdf);base64,/i, 'Comprovante inválido')
  .max(7_000_000);

const inputSchema = z.object({
  method: receiptMethodSchema,
  proofDataUrl: proofSchema,
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function submitPayment(
  repo: ReceiptRepository,
  id: string,
  input: unknown,
): Promise<Receipt> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new ReceiptValidationError('Dados do pagamento inválidos');
  const existing = await repo.getById(id);
  if (!existing) throw new ReceiptNotFoundError(id);
  const updated = receiptSchema.parse({
    ...existing,
    status: 'em_analise',
    method: parsed.data.method,
    submittedAt: parsed.data.today,
    proofDataUrl: parsed.data.proofDataUrl,
  });
  return repo.save(updated);
}
