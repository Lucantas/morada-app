import { reclassifyAccounts } from './reclassify';

const cats = [
  { name: 'Água', keywords: 'água, saneamento' },
  { name: 'Energia', keywords: 'energia, luz' },
];

describe('reclassifyAccounts', () => {
  test('matches accent- and case-insensitively on description + category', () => {
    const { changed, reclassified } = reclassifyAccounts(cats, [
      { id: 'a1', category: 'Sem categoria', description: 'Conta de AGUA do mês' },
    ]);
    expect(reclassified).toBe(1);
    expect(changed).toEqual([{ id: 'a1', category: 'Água', description: 'Conta de AGUA do mês' }]);
  });

  test('the first matching category (list order) wins', () => {
    const { changed } = reclassifyAccounts(
      [
        { name: 'Energia', keywords: 'conta' },
        { name: 'Água', keywords: 'conta' },
      ],
      [{ id: 'a1', category: 'x', description: 'conta' }],
    );
    expect(changed).toEqual([{ id: 'a1', category: 'Energia', description: 'conta' }]);
  });

  test('leaves an account unchanged when it already has the matched category', () => {
    const { changed, reclassified } = reclassifyAccounts(cats, [
      { id: 'a1', category: 'Água', description: 'água' },
    ]);
    expect(reclassified).toBe(0);
    expect(changed).toEqual([]);
  });

  test('leaves an account unchanged when nothing matches', () => {
    const { changed, reclassified } = reclassifyAccounts(cats, [
      { id: 'a1', category: 'Outros', description: 'padaria' },
    ]);
    expect(reclassified).toBe(0);
    expect(changed).toEqual([]);
  });

  test('ignores empty keywords and does not mutate the input', () => {
    const accounts = [{ id: 'a1', category: 'x', description: 'luz' }];
    reclassifyAccounts([{ name: 'Energia', keywords: ' , luz ,' }], accounts);
    expect(accounts).toEqual([{ id: 'a1', category: 'x', description: 'luz' }]);
  });
});
