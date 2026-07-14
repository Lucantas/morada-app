import { deriveResidentStatus } from './derive-status';

const TODAY = '2026-05-15';

describe('deriveResidentStatus', () => {
  test('no pending receipt is em_dia', () => {
    expect(deriveResidentStatus([{ status: 'pago', dueDate: '2026-04-10' }], TODAY)).toBe('em_dia');
    expect(deriveResidentStatus([], TODAY)).toBe('em_dia');
  });

  test('a pending receipt still within its due date is pendente', () => {
    expect(deriveResidentStatus([{ status: 'pendente', dueDate: '2026-05-20' }], TODAY)).toBe(
      'pendente',
    );
  });

  test('a pending receipt past its due date is atrasado', () => {
    expect(deriveResidentStatus([{ status: 'pendente', dueDate: '2026-05-10' }], TODAY)).toBe(
      'atrasado',
    );
  });

  test('a pending receipt without a due date is pendente (not atrasado)', () => {
    expect(deriveResidentStatus([{ status: 'pendente', dueDate: null }], TODAY)).toBe('pendente');
  });
});
