import type { DashboardSummary } from './dashboard';

export interface DashboardRepository {
  getSummary(): Promise<DashboardSummary>;
}
