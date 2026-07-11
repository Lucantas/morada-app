import { z } from 'zod';

export const residentStatusSchema = z.enum(['em_dia', 'pendente', 'atrasado']);
export type ResidentStatus = z.infer<typeof residentStatusSchema>;

export const residentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  apt: z.string().min(1),
  phone: z.string(),
  email: z.string(),
  status: residentStatusSchema,
});
export type Resident = z.infer<typeof residentSchema>;

export const residentDraftSchema = residentSchema.extend({ id: z.string().min(1).optional() });
export type ResidentDraft = z.infer<typeof residentDraftSchema>;
