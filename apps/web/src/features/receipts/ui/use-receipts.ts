import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listReceipts } from '../domain/list-receipts';
import { payReceipt } from '../domain/pay-receipt';
import type { ReceiptMethod } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

export const receiptsQueryKey = ['receipts'] as const;

export function useReceipts(repository: ReceiptRepository) {
  return useQuery({ queryKey: receiptsQueryKey, queryFn: () => listReceipts(repository) });
}

export function usePayReceipt(repository: ReceiptRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, method }: { id: string; method: ReceiptMethod }) =>
      payReceipt(repository, id, method),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: receiptsQueryKey }),
  });
}
