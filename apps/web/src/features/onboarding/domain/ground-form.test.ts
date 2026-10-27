import {
  addCategory,
  groundInputFromForm,
  initialGroundForm,
  setCategorySpend,
  toggleCategory,
  type GroundForm,
} from './ground-form';

const NAMES = ['Água', 'Energia', 'Serviços'];

function form(overrides: Partial<GroundForm> = {}): GroundForm {
  return { ...initialGroundForm(NAMES), ...overrides };
}

describe('ground form', () => {
  test('starts with every current category selected and nothing typed', () => {
    expect(groundInputFromForm(initialGroundForm(NAMES))).toEqual({
      categories: NAMES,
      spend: { kind: 'byCategory', items: [] },
      cashCents: null,
    });
  });

  test('toggling a category removes and restores it in its original order', () => {
    const without = toggleCategory(form(), 'Água');
    const back = toggleCategory(without, 'Água');

    expect(groundInputFromForm(without).categories).toEqual(['Energia', 'Serviços']);
    expect(groundInputFromForm(back).categories).toEqual(NAMES);
  });

  test('per-category spend only counts selected categories', () => {
    const typed = setCategorySpend(setCategorySpend(form(), 'Água', 34800), 'Energia', 1000);
    const next = toggleCategory(typed, 'Energia');

    expect(groundInputFromForm(next).spend).toEqual({
      kind: 'byCategory',
      items: [
        { category: 'Água', cents: 34800 },
        { category: 'Serviços', cents: 0 },
      ],
    });
  });

  test('total and later spend modes', () => {
    expect(groundInputFromForm(form({ spendMode: 'total', totalCents: 500 })).spend).toEqual({
      kind: 'total',
      cents: 500,
    });
    expect(groundInputFromForm(form({ spendMode: 'later' })).spend).toEqual({ kind: 'none' });
  });

  test('cash modes', () => {
    expect(groundInputFromForm(form({ cashMode: 'empty', cashCents: 900 })).cashCents).toBe(0);
    expect(groundInputFromForm(form({ cashMode: 'later', cashCents: 900 })).cashCents).toBeNull();
    expect(groundInputFromForm(form({ cashMode: 'value', cashCents: 900 })).cashCents).toBe(900);
    expect(groundInputFromForm(form({ cashMode: 'value', cashCents: 0 })).cashCents).toBeNull();
  });

  test('adds another category selected', () => {
    const result = addCategory(form(), '  Limpeza ');

    expect('form' in result && groundInputFromForm(result.form).categories).toEqual([
      ...NAMES,
      'Limpeza',
    ]);
  });

  test('rejects an empty, repeated or too long category', () => {
    expect(addCategory(form(), '  ')).toEqual({ error: 'Informe o nome da conta.' });
    expect(addCategory(form(), 'água')).toEqual({ error: 'Essa conta já está na lista.' });
    expect(addCategory(form(), 'x'.repeat(61))).toEqual({ error: 'Use até 60 caracteres.' });
  });
});
