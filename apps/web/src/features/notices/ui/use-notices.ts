import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { clearNotices, dismissNotice } from '../domain/dismiss-notice';
import { createNotice } from '../domain/create-notice';
import { listNotices } from '../domain/list-notices';
import type { NoticeDraft } from '../domain/notice';
import type { NoticeRepository } from '../domain/notice-repository';

export const noticesQueryKey = ['notices'] as const;

export function useNotices(repository: NoticeRepository) {
  return useQuery({ queryKey: noticesQueryKey, queryFn: () => listNotices(repository) });
}

export function useCreateNotice(repository: NoticeRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: NoticeDraft) => createNotice(repository, draft),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noticesQueryKey }),
  });
}

export function useDismissNotice(repository: NoticeRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dismissNotice(repository, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noticesQueryKey }),
  });
}

export function useClearNotices(repository: NoticeRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => clearNotices(repository),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noticesQueryKey }),
  });
}
