import { noticeKindView } from './notice-kind-view';

describe('noticeKindView', () => {
  test('maps aviso to the info tone', () => {
    expect(noticeKindView('aviso')).toEqual({ tone: 'info', label: 'Aviso' });
  });

  test('maps urgente to the atrasado tone', () => {
    expect(noticeKindView('urgente')).toEqual({ tone: 'atrasado', label: 'Urgente' });
  });

  test('maps manutencao to the pendente tone', () => {
    expect(noticeKindView('manutencao')).toEqual({ tone: 'pendente', label: 'Manutenção' });
  });
});
