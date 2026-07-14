import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ReceiptRepository } from '@/features/receipts/domain/receipt-repository';

import { listResidents } from '../domain/list-residents';
import type { ResidentDraft } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';
import { saveResident } from '../domain/save-resident';

export const residentsQueryKey = ['residents'] as const;

export function useResidents(repository: ResidentRepository) {
  return useQuery({ queryKey: residentsQueryKey, queryFn: () => listResidents(repository) });
}

export function useApartmentResidents(repository: ResidentRepository, apartmentId?: string) {
  return useQuery({
    queryKey: [...residentsQueryKey, 'apartment', apartmentId],
    queryFn: () => repository.listByApartment(apartmentId as string),
    enabled: apartmentId !== undefined,
  });
}

export function useApartmentReceipts(repository: ReceiptRepository, apartmentId?: string) {
  return useQuery({
    queryKey: ['receipts', 'apartment', apartmentId],
    queryFn: () => repository.listByApartment(apartmentId as string),
    enabled: apartmentId !== undefined,
  });
}

export function useSaveResident(repository: ResidentRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: ResidentDraft) => saveResident(repository, draft),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: residentsQueryKey }),
  });
}

export function useDeactivateResident(repository: ResidentRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repository.deactivate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: residentsQueryKey }),
  });
}
