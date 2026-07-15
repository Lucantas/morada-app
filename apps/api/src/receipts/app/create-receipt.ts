import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { ChargeResidentNotFoundError, ReceiptValidationError } from '../domain/errors';
import { isoDateSchema, receiptMethodSchema, receiptSchema, type Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

// Resolves the apartment a resident occupies, so the charge is anchored to both
// the resident and their apartment. Returns null when the resident is unknown.
export type ResidentApartmentLookup = (
  residentId: string,
) => Promise<{ apartmentId: string } | null>;

const inputSchema = z.object({
  residentId: z.string().min(1).max(64),
  ref: z.string().min(1).max(40),
  title: z.string().min(1).max(120),
  valueCents: z.number().int().min(0).max(1_000_000_000),
  dueDate: isoDateSchema,
  paidAt: isoDateSchema.optional(),
  method: receiptMethodSchema.optional(),
});

export async function createReceipt(
  repo: ReceiptRepository,
  residentApartment: ResidentApartmentLookup,
  input: unknown,
): Promise<Receipt> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new ReceiptValidationError('Dados da cobrança inválidos');
  const apartment = await residentApartment(parsed.data.residentId);
  if (!apartment) throw new ChargeResidentNotFoundError(parsed.data.residentId);
  const paid = parsed.data.paidAt !== undefined && parsed.data.method !== undefined;
  const { paidAt, method, ...base } = parsed.data;
  const receipt = receiptSchema.parse({
    ...base,
    id: randomUUID(),
    apartmentId: apartment.apartmentId,
    status: paid ? 'pago' : 'pendente',
    ...(paid ? { paidAt, method } : {}),
  });
  return repo.save(receipt);
}
