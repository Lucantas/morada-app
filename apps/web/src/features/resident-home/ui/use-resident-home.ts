import { useQuery } from '@tanstack/react-query';

import { listReceipts } from '@/features/receipts/domain/list-receipts';
import type { ReceiptRepository } from '@/features/receipts/domain/receipt-repository';

export const residentHomeQueryKey = ['resident-home', 'receipts'] as const;

export function useResidentHome(receiptRepository: ReceiptRepository) {
  return useQuery({
    queryKey: residentHomeQueryKey,
    queryFn: () => listReceipts(receiptRepository),
  });
}
