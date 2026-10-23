import { useQuery } from '@tanstack/react-query';

import type { ResidentRepository } from '../domain/resident-repository';

export const currentResidentQueryKey = ['current-resident'] as const;

export function useCurrentResident(repository: ResidentRepository, scopeKey: string | null) {
  return useQuery({
    queryKey: [...currentResidentQueryKey, scopeKey],
    queryFn: () => repository.getCurrent(scopeKey as string),
    enabled: scopeKey !== null,
  });
}
