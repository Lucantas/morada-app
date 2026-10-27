import { useQuery } from '@tanstack/react-query';

import { useCondoScope } from '@/shared/lib/condo-scope';

import type { BuildingRepository } from '../domain/building-repository';

export const buildingQueryKey = (condoId: string) => ['building', condoId] as const;

export function useBuilding(repository: BuildingRepository) {
  const condoId = useCondoScope((state) => state.condo?.id ?? null);
  return useQuery({
    queryKey: buildingQueryKey(condoId ?? ''),
    queryFn: () => repository.get(),
    enabled: condoId !== null,
  });
}
