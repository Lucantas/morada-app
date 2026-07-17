import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listReceipts } from '../domain/list-receipts';
import type { ReceiptMethod } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

export const receiptsQueryKey = ['receipts'] as const;

export function useReceipts(repository: ReceiptRepository) {
  return useQuery({ queryKey: receiptsQueryKey, queryFn: () => listReceipts(repository) });
}

export function useSubmitPayment(repository: ReceiptRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      method,
      proofDataUrl,
    }: {
      id: string;
      method: ReceiptMethod;
      proofDataUrl: string;
    }) => repository.submitPayment(id, { method, proofDataUrl }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: receiptsQueryKey }),
  });
}

export function useArchiveReceipt(repository: ReceiptRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repository.archive(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: receiptsQueryKey });
      void queryClient.invalidateQueries({ queryKey: ['residents'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
