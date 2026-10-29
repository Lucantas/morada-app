import type { Account } from './account';
import { effectiveAccountStatus, overdueCount } from './effective-status';

const TODAY = '2026-10-29';

describe('effectiveAccountStatus', () => {
  test('turns a pending account due before today into atrasado', () => {
    expect(effectiveAccountStatus({ status: 'pendente', dueDate: '2026-10-28' }, TODAY)).toBe(
      'atrasado',
    );
  });

  test('keeps a pending account due today as pendente', () => {
    expect(effectiveAccountStatus({ status: 'pendente', dueDate: TODAY }, TODAY)).toBe('pendente');
  });

  test('keeps a pending account without due date as pendente', () => {
    expect(effectiveAccountStatus({ status: 'pendente', dueDate: null }, TODAY)).toBe('pendente');
    expect(effectiveAccountStatus({ status: 'pendente' }, TODAY)).toBe('pendente');
  });

  test('keeps a paid account paid even with a past due date', () => {
    expect(effectiveAccountStatus({ status: 'pago', dueDate: '2026-01-01' }, TODAY)).toBe('pago');
  });

  test('keeps a stored atrasado account atrasado', () => {
    expect(effectiveAccountStatus({ status: 'atrasado', dueDate: null }, TODAY)).toBe('atrasado');
  });
});

describe('overdueCount', () => {
  const build = (id: string, status: Account['status'], dueDate: string | null): Account => ({
    id,
    description: id,
    category: 'Utilidades',
    date: '2026-10-01',
    dueDate,
    valueCents: 100,
    status,
  });

  test('counts effectively overdue accounts only', () => {
    const accounts = [
      build('a', 'pendente', '2026-10-01'),
      build('b', 'atrasado', null),
      build('c', 'pago', '2026-10-01'),
      build('d', 'pendente', TODAY),
    ];

    expect(overdueCount(accounts, TODAY)).toBe(2);
  });
});
