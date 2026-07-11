import { useQuery } from '@tanstack/react-query';

import type { DashboardRepository } from '../domain/dashboard-repository';
import { getDashboardSummary } from '../domain/get-dashboard-summary';

export const dashboardQueryKey = ['dashboard'] as const;

export function useDashboard(repository: DashboardRepository) {
  return useQuery({
    queryKey: dashboardQueryKey,
    queryFn: () => getDashboardSummary(repository),
  });
}
