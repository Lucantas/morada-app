import type { Receipt } from '@/features/receipts/domain/receipt';

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${(seq += 1)}`;

export function buildReceipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    id: nextId('receipt'),
    ref: '04/2026',
    title: 'Taxa condominial',
    dueLabel: 'Venc. 10/04/2026',
    valueCents: 45000,
    status: 'pendente',
    ...overrides,
  };
}
