import type { Receipt } from '@/features/receipts/domain/receipt';

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${(seq += 1)}`;

export function buildReceipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    id: nextId('receipt'),
    ref: '04/2026',
    title: 'Taxa condominial',
    dueDate: '2026-04-10',
    valueCents: 45000,
    status: 'pendente',
    ...overrides,
  };
}
