import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AccountDraft } from '../domain/account';
import type { AccountRepository } from '../domain/account-repository';
import { listAccounts } from '../domain/list-accounts';
import { saveAccount } from '../domain/save-account';

export const accountsQueryKey = ['accounts'] as const;

export function useAccounts(repository: AccountRepository) {
  return useQuery({ queryKey: accountsQueryKey, queryFn: () => listAccounts(repository) });
}

export function useSaveAccount(repository: AccountRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: AccountDraft) => saveAccount(repository, draft),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountsQueryKey }),
  });
}
