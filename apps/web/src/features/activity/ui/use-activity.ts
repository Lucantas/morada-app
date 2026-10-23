import { useQuery } from '@tanstack/react-query';

import type { ActivityRepository } from '../domain/activity-repository';

export const activityQueryKey = ['activity'] as const;

export function useActivity(repository: ActivityRepository) {
  return useQuery({ queryKey: activityQueryKey, queryFn: () => repository.list() });
}
