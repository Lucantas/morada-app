import { methodLabel, receiptStatusView } from './receipt-status-view';

describe('receiptStatusView', () => {
  test('maps pago to the pago tone', () => {
    expect(receiptStatusView('pago')).toEqual({ tone: 'pago', label: 'Pago' });
  });

  test('maps pendente to the pendente tone', () => {
    expect(receiptStatusView('pendente')).toEqual({ tone: 'pendente', label: 'Pendente' });
  });
});

describe('methodLabel', () => {
  test('maps each method to its label', () => {
    expect(methodLabel('pix')).toBe('Pix');
    expect(methodLabel('boleto')).toBe('Boleto');
    expect(methodLabel('cartao')).toBe('Cartão');
  });
});
