import type { DashboardSummary } from '../domain/dashboard';
import type { DashboardRepository } from '../domain/dashboard-repository';

export async function getDashboardSummary(repo: DashboardRepository): Promise<DashboardSummary> {
  return repo.getSummary();
}
