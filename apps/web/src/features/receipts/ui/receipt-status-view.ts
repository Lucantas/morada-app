import type { PillTone } from '@/shared/ui/status-pill';

import type { ReceiptMethod, ReceiptStatus } from '../domain/receipt';

const VIEW: Record<ReceiptStatus, { tone: PillTone; label: string }> = {
  pago: { tone: 'pago', label: 'Pago' },
  pendente: { tone: 'pendente', label: 'Pendente' },
};

const METHOD_LABELS: Record<ReceiptMethod, string> = {
  pix: 'Pix',
  boleto: 'Boleto',
  cartao: 'Cartão',
};

export function receiptStatusView(status: ReceiptStatus): { tone: PillTone; label: string } {
  return VIEW[status];
}

export function methodLabel(method: ReceiptMethod): string {
  return METHOD_LABELS[method];
}
