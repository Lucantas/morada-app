import { useQuery } from '@tanstack/react-query';

import type { StreetRepository } from '../domain/street-repository';

export const streetQueryKey = ['street'] as const;

export function useStreet(repository: StreetRepository) {
  return useQuery({
    queryKey: streetQueryKey,
    queryFn: () => repository.get(),
  });
}
