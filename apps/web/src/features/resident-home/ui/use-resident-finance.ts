import { useQuery } from '@tanstack/react-query';

import type { DashboardRepository } from '@/features/dashboard/domain/dashboard-repository';
import { getDashboardSummary } from '@/features/dashboard/domain/get-dashboard-summary';

export const residentFinanceQueryKey = ['resident-home', 'finance'] as const;

export function useResidentFinance(dashboardRepository: DashboardRepository) {
  return useQuery({
    queryKey: residentFinanceQueryKey,
    queryFn: () => getDashboardSummary(dashboardRepository),
  });
}
