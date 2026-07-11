import type { DashboardSummary } from '../domain/dashboard';
import type { DashboardRepository } from '../domain/dashboard-repository';

export function getDashboardSummary(repo: DashboardRepository): DashboardSummary {
  return repo.getSummary();
}
