import { z } from 'zod';

export const condoBalanceSchema = z.object({
  balanceCents: z.number(),
  incomeCents: z.number(),
  paidCents: z.number(),
});
export type CondoBalance = z.infer<typeof condoBalanceSchema>;

export const paidItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  dateLabel: z.string().min(1),
  valueCents: z.number(),
  icon: z.enum(['water', 'bolt']),
});
export type PaidItem = z.infer<typeof paidItemSchema>;

export const maintenanceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().min(1),
  icon: z.enum(['wrench', 'building2']),
});
export type Maintenance = z.infer<typeof maintenanceSchema>;

export const dashboardSummarySchema = z.object({
  balance: condoBalanceSchema,
  recentPaid: z.array(paidItemSchema),
  maintenances: z.array(maintenanceSchema),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
