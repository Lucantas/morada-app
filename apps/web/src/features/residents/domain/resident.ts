import { z } from 'zod';

export const residentStatusSchema = z.enum(['em_dia', 'pendente', 'atrasado']);
export type ResidentStatus = z.infer<typeof residentStatusSchema>;

export const residentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  apt: z.string().min(1),
  apartmentId: z.string().optional(),
  phone: z.string(),
  email: z.string(),
  status: residentStatusSchema,
  active: z.boolean().optional(),
});
export type Resident = z.infer<typeof residentSchema>;

export const residentDraftSchema = residentSchema.extend({
  id: z.string().min(1).optional(),
});
export type ResidentDraft = z.infer<typeof residentDraftSchema>;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}
