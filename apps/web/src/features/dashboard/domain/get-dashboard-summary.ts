import type { DashboardSummary } from './dashboard';
import type { DashboardRepository } from './dashboard-repository';

export async function getDashboardSummary(
  repository: DashboardRepository,
): Promise<DashboardSummary> {
  return repository.getSummary();
}
