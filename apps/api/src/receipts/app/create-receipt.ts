import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { ChargeResidentNotFoundError, ReceiptValidationError } from '../domain/errors';
import { receiptSchema, type Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

// Resolves the apartment a resident occupies, so the charge is anchored to both
// the resident and their apartment. Returns null when the resident is unknown.
export type ResidentApartmentLookup = (residentId: string) => { apartmentId: string } | null;

const inputSchema = z.object({
  residentId: z.string().min(1).max(64),
  ref: z.string().min(1).max(40),
  title: z.string().min(1).max(120),
  valueCents: z.number().int().min(0).max(1_000_000_000),
  dueLabel: z.string().min(1).max(60),
});

export function createReceipt(
  repo: ReceiptRepository,
  residentApartment: ResidentApartmentLookup,
  input: unknown,
): Receipt {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new ReceiptValidationError('Dados da cobrança inválidos');
  const apartment = residentApartment(parsed.data.residentId);
  if (!apartment) throw new ChargeResidentNotFoundError(parsed.data.residentId);
  const receipt = receiptSchema.parse({
    ...parsed.data,
    id: randomUUID(),
    status: 'pendente',
    apartmentId: apartment.apartmentId,
  });
  return repo.save(receipt);
}
