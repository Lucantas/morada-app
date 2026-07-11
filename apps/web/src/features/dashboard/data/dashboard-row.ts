import { dashboardSummarySchema, type DashboardSummary } from '../domain/dashboard';

export function toDashboardSummary(raw: unknown): DashboardSummary {
  return dashboardSummarySchema.parse(raw);
}
