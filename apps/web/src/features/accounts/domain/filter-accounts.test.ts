import { buildAccount } from '@/test/factories.accounts';

import { filterAccounts } from './filter-accounts';

const accounts = [
  buildAccount({
    id: 'a-1',
    description: 'Água — abril',
    category: 'Utilidades',
    date: '2026-04-05',
  }),
  buildAccount({
    id: 'a-2',
    description: 'Jardinagem',
    category: 'Manutenção',
    date: '2026-05-10',
  }),
  buildAccount({
    id: 'a-3',
    description: 'Energia — abril',
    category: 'Utilidades',
    date: '2026-04-20',
  }),
  buildAccount({
    id: 'a-4',
    description: 'Reserva legado',
    category: 'Outros',
    date: null,
  }),
];

const emptyFilters = { query: '', category: '', from: '', to: '' };

describe('filterAccounts', () => {
  test('returns all accounts when filters are empty', () => {
    expect(filterAccounts(accounts, emptyFilters).map((a) => a.id)).toEqual([
      'a-1',
      'a-2',
      'a-3',
      'a-4',
    ]);
  });

  test('matches by description, accent- and case-insensitively', () => {
    expect(filterAccounts(accounts, { ...emptyFilters, query: 'agua' }).map((a) => a.id)).toEqual([
      'a-1',
    ]);
    expect(filterAccounts(accounts, { ...emptyFilters, query: 'ÁGUA' }).map((a) => a.id)).toEqual([
      'a-1',
    ]);
  });

  test('matches category exactly', () => {
    expect(
      filterAccounts(accounts, { ...emptyFilters, category: 'Utilidades' }).map((a) => a.id),
    ).toEqual(['a-1', 'a-3']);
  });

  test('applies inclusive from/to date bounds', () => {
    expect(
      filterAccounts(accounts, { ...emptyFilters, from: '2026-04-05', to: '2026-04-20' }).map(
        (a) => a.id,
      ),
    ).toEqual(['a-1', 'a-3']);
  });

  test('excludes a null-date account when either bound is set', () => {
    expect(
      filterAccounts(accounts, { ...emptyFilters, from: '2026-01-01' }).map((a) => a.id),
    ).toEqual(['a-1', 'a-2', 'a-3']);
    expect(
      filterAccounts(accounts, { ...emptyFilters, to: '2026-12-31' }).map((a) => a.id),
    ).toEqual(['a-1', 'a-2', 'a-3']);
  });

  test('combines query, category and date filters', () => {
    expect(
      filterAccounts(accounts, {
        query: 'abril',
        category: 'Utilidades',
        from: '2026-04-01',
        to: '2026-04-10',
      }).map((a) => a.id),
    ).toEqual(['a-1']);
  });

  test('does not mutate the input array', () => {
    const copy = [...accounts];
    filterAccounts(accounts, { ...emptyFilters, category: 'Utilidades' });
    expect(accounts).toEqual(copy);
  });
});
