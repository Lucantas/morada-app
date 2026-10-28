import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useCondoScope } from '@/shared/lib/condo-scope';

import { buildingQueryKey } from '../domain/building';
import type { BuildingRepository, NewApartment } from '../domain/building-repository';

export function useBuildingMutations(repository: BuildingRepository) {
  const queryClient = useQueryClient();
  const condoId = useCondoScope((state) => state.condo?.id ?? '');
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: buildingQueryKey(condoId) });

  const add = useMutation({
    mutationFn: (input: NewApartment) => repository.addApartment(input),
    onSuccess,
  });
  const rename = useMutation({
    mutationFn: (input: { id: string; label: string }) =>
      repository.renameApartment(input.id, input.label),
    onSuccess,
  });
  const deactivate = useMutation({
    mutationFn: (id: string) => repository.deactivateApartment(id),
    onSuccess,
  });
  return { add, rename, deactivate };
}
