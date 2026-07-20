import type { Receipt } from './receipt';
import { sortReceiptsByRecencyDesc } from './sort-receipts';

function mk(id: string, ref: string, dueDate: string | null): Receipt {
  return {
    id,
    ref,
    title: 'Taxa condominial',
    dueDate,
    valueCents: 45000,
    status: 'pendente',
  };
}

describe('sortReceiptsByRecencyDesc', () => {
  test('orders by due date with the most recent first', () => {
    const receipts = [
      mk('a', '01/2026', '2026-01-15'),
      mk('b', '07/2026', '2026-07-15'),
      mk('c', '03/2026', '2026-03-15'),
    ];

    expect(sortReceiptsByRecencyDesc(receipts).map((r) => r.ref)).toEqual([
      '07/2026',
      '03/2026',
      '01/2026',
    ]);
  });

  test('keeps chronology across year boundaries (never lexicographic ref order)', () => {
    const receipts = [
      mk('a', '01/2026', '2026-01-15'),
      mk('b', '12/2025', '2025-12-15'),
      mk('c', '11/2025', '2025-11-15'),
    ];

    expect(sortReceiptsByRecencyDesc(receipts).map((r) => r.ref)).toEqual([
      '01/2026',
      '12/2025',
      '11/2025',
    ]);
  });

  test('falls back to the ref month when due date is null', () => {
    const receipts = [mk('a', '02/2026', null), mk('b', '07/2026', null), mk('c', '01/2026', null)];

    expect(sortReceiptsByRecencyDesc(receipts).map((r) => r.ref)).toEqual([
      '07/2026',
      '02/2026',
      '01/2026',
    ]);
  });

  test('does not mutate the input array', () => {
    const receipts = [mk('a', '01/2026', '2026-01-15'), mk('b', '07/2026', '2026-07-15')];

    sortReceiptsByRecencyDesc(receipts);

    expect(receipts.map((r) => r.id)).toEqual(['a', 'b']);
  });
});
