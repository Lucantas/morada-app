import { formatBRL } from '@/shared/lib/money';

import type { Receipt } from './receipt';

// A plain-text payment proof for a paid receipt, offered as a download.
export function buildReceiptProof(
  receipt: Receipt,
  resident: { name: string; apt: string },
): string {
  return [
    'Condomínio Morada · Bloco 2',
    'Comprovante de pagamento',
    '',
    `Morador: ${resident.name} · ${resident.apt}`,
    `Referência: ${receipt.ref}`,
    `Descrição: ${receipt.title}`,
    `Valor: R$ ${formatBRL(receipt.valueCents)}`,
    `Situação: ${receipt.status === 'pago' ? 'Pago' : 'Pendente'}`,
    receipt.method ? `Forma de pagamento: ${receipt.method}` : '',
    receipt.dueLabel,
  ]
    .filter(Boolean)
    .join('\n');
}

export function proofFileName(receipt: Pick<Receipt, 'ref'>): string {
  return `comprovante-morada-${receipt.ref.replace(/\D/g, '')}.txt`;
}
