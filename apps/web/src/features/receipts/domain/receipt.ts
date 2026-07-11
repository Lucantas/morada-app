import { z } from 'zod';

export const receiptStatusSchema = z.enum(['pago', 'pendente']);
export type ReceiptStatus = z.infer<typeof receiptStatusSchema>;

export const receiptMethodSchema = z.enum(['pix', 'boleto', 'cartao']);
export type ReceiptMethod = z.infer<typeof receiptMethodSchema>;

export const receiptSchema = z.object({
  id: z.string().min(1),
  ref: z.string().min(1),
  title: z.string().min(1),
  dueLabel: z.string().min(1),
  valueCents: z.number().int(),
  status: receiptStatusSchema,
  method: receiptMethodSchema.optional(),
});
export type Receipt = z.infer<typeof receiptSchema>;
