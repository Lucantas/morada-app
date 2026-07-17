import { apartmentReceiptTotals } from './apartment-receipt-totals';

test('sums paid vs open (pendente + em_analise)', () => {
  const r = (id: string, status: string, valueCents: number) =>
    ({ id, status, valueCents }) as never;
  expect(
    apartmentReceiptTotals([
      r('a', 'pago', 15000),
      r('b', 'pendente', 15000),
      r('c', 'em_analise', 15000),
      r('d', 'pago', 5000),
    ]),
  ).toEqual({ paidCents: 20000, openCents: 30000 });
});
