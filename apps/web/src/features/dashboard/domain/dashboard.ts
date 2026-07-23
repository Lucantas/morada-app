import { z } from 'zod';

export const condoBalanceSchema = z.object({
  balanceCents: z.number(),
  incomeCents: z.number(),
  paidCents: z.number(),
});
export type CondoBalance = z.infer<typeof condoBalanceSchema>;

export const dashIconSchema = z.enum([
  'water',
  'bolt',
  'wrench',
  'building2',
  'building',
  'receipt',
  'card',
]);
export type DashIcon = z.infer<typeof dashIconSchema>;

export const paidItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  dateLabel: z.string().min(1),
  valueCents: z.number(),
  icon: dashIconSchema,
  hasProof: z.boolean().optional(),
});
export type PaidItem = z.infer<typeof paidItemSchema>;

export const maintenanceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().min(1),
  icon: dashIconSchema,
});
export type Maintenance = z.infer<typeof maintenanceSchema>;

export const dashboardSummarySchema = z.object({
  balance: condoBalanceSchema,
  recentPaid: z.array(paidItemSchema),
  maintenances: z.array(maintenanceSchema),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
