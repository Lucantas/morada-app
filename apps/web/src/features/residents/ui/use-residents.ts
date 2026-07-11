import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listResidents } from '../domain/list-residents';
import type { ResidentDraft } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';
import { saveResident } from '../domain/save-resident';

export const residentsQueryKey = ['residents'] as const;

export function useResidents(repository: ResidentRepository) {
  return useQuery({ queryKey: residentsQueryKey, queryFn: () => listResidents(repository) });
}

export function useSaveResident(repository: ResidentRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: ResidentDraft) => saveResident(repository, draft),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: residentsQueryKey }),
  });
}
