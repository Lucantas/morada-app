import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCondoScope } from '@/shared/lib/condo-scope';

import type { CondoInfoRepository } from '../domain/condo-info-repository';

export const condoInfoQueryKey = ['condo-info'] as const;

export function useCondoInfo(repository: CondoInfoRepository) {
  const condoId = useCondoScope((s) => s.condo?.id ?? null);
  return useQuery({
    queryKey: [...condoInfoQueryKey, condoId],
    queryFn: () => repository.get(),
    enabled: condoId !== null,
  });
}

export function useRenameCondo(repository: CondoInfoRepository) {
  const queryClient = useQueryClient();
  const rename = useCondoScope((s) => s.rename);
  return useMutation({
    mutationFn: (name: string) => repository.rename(name),
    onSuccess: (info) => {
      rename(info.name);
      return queryClient.invalidateQueries({ queryKey: condoInfoQueryKey });
    },
  });
}
