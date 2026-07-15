import { methodLabel, receiptStatusView } from './receipt-status-view';

describe('receiptStatusView', () => {
  test('maps pago to the pago tone', () => {
    expect(receiptStatusView('pago')).toEqual({ tone: 'pago', label: 'Pago' });
  });

  test('maps pendente to the pendente tone', () => {
    expect(receiptStatusView('pendente')).toEqual({ tone: 'pendente', label: 'Pendente' });
  });

  test('maps em_analise to the pendente tone', () => {
    expect(receiptStatusView('em_analise')).toEqual({ tone: 'pendente', label: 'Em análise' });
  });
});

describe('methodLabel', () => {
  test('maps each method to its label', () => {
    expect(methodLabel('dinheiro')).toBe('Dinheiro');
    expect(methodLabel('pix')).toBe('Pix');
  });
});
