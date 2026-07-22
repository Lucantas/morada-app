import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { IncomeDraft } from '../domain/income';
import type { IncomeRepository } from '../domain/income-repository';

export const incomeQueryKey = ['incomes'] as const;

export function useIncomes(repository: IncomeRepository) {
  return useQuery({ queryKey: incomeQueryKey, queryFn: () => repository.list() });
}

export function useSaveIncome(repository: IncomeRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: IncomeDraft) => repository.save(draft),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: incomeQueryKey });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useArchiveIncome(repository: IncomeRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repository.archive(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: incomeQueryKey });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
