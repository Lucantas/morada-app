import { z } from 'zod';

export const receiptStatusSchema = z.enum(['pago', 'pendente']);
export type ReceiptStatus = z.infer<typeof receiptStatusSchema>;

export const receiptMethodSchema = z.enum(['dinheiro', 'pix']);
export type ReceiptMethod = z.infer<typeof receiptMethodSchema>;

export const receiptSchema = z.object({
  id: z.string().min(1),
  ref: z.string().min(1),
  title: z.string().min(1),
  // Due date and payment date as ISO (YYYY-MM-DD); dueDate is null only for
  // legacy rows, paidAt is absent until the receipt is paid.
  dueDate: z.string().nullable(),
  paidAt: z.string().optional(),
  valueCents: z.number().int(),
  status: receiptStatusSchema,
  method: receiptMethodSchema.optional(),
  residentId: z.string().min(1).optional(),
  apartmentId: z.string().min(1).optional(),
});
export type Receipt = z.infer<typeof receiptSchema>;
