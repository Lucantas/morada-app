import { z } from 'zod';

export const residentStatusSchema = z.enum(['em_dia', 'pendente', 'atrasado']);
export type ResidentStatus = z.infer<typeof residentStatusSchema>;

// A resident is a person; `apt`/`apartmentId` describe the apartment they occupy
// (resolved from the occupancy on read), and `active` is their occupancy state.
export const residentSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  apt: z.string().min(1).max(40),
  apartmentId: z.string().min(1).max(64),
  phone: z.string().max(40),
  email: z.string().max(160),
  status: residentStatusSchema,
  active: z.boolean(),
});
export type Resident = z.infer<typeof residentSchema>;

// Admin input for creating/updating a resident: the apartment is given by its
// label (`apt`); the id/apartmentId/active are assigned by the repository.
export const residentDraftSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1).max(120),
  apt: z.string().min(1).max(40),
  phone: z.string().max(40),
  email: z.string().max(160),
  status: residentStatusSchema,
});
export type ResidentDraft = z.infer<typeof residentDraftSchema>;
