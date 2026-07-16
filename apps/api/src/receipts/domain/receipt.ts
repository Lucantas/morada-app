import { z } from 'zod';

import { isoDateSchema } from '../../shared/domain/iso-date';

export { isoDateSchema };

export const receiptStatusSchema = z.enum(['pendente', 'em_analise', 'pago']);
export type ReceiptStatus = z.infer<typeof receiptStatusSchema>;

export const receiptMethodSchema = z.enum(['dinheiro', 'pix']);
export type ReceiptMethod = z.infer<typeof receiptMethodSchema>;

export const receiptSchema = z.object({
  id: z.string().min(1),
  ref: z.string().min(1),
  title: z.string().min(1),
  // Due date (when the charge is due). Nullable only for legacy rows created
  // before dates were structured; every new receipt sets it.
  dueDate: isoDateSchema.nullable(),
  // When the charge was actually paid; absent while pending. Set on payment.
  paidAt: isoDateSchema.optional(),
  submittedAt: isoDateSchema.optional(),
  proofDataUrl: z.string().max(7_000_000).optional(),
  valueCents: z.number().int(),
  status: receiptStatusSchema,
  method: receiptMethodSchema.optional(),
  residentId: z.string().min(1).max(64).optional(),
  apartmentId: z.string().min(1).max(64).optional(),
});
export type Receipt = z.infer<typeof receiptSchema>;
