import { useQuery } from '@tanstack/react-query';

import type { ResidentRepository } from '../domain/resident-repository';

export const currentResidentQueryKey = ['current-resident'] as const;

export function useCurrentResident(repository: ResidentRepository, subject: string | null) {
  return useQuery({
    queryKey: [...currentResidentQueryKey, subject],
    queryFn: () => repository.getCurrent(subject as string),
    enabled: subject !== null,
  });
}
