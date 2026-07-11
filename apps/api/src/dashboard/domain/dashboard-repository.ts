import type { DashboardSummary } from './dashboard';

export interface DashboardRepository {
  getSummary(): DashboardSummary;
}
