import {
  greeting,
  levelOf,
  miniBuilding,
  reasonsOf,
  sortByUrgency,
  summaryLine,
  type Pendencies,
  type StreetCondo,
} from './street';

const none: Pendencies = {
  overdueResidents: 0,
  overdueAccounts: 0,
  accountsDueSoon: 0,
  proofsToReview: 0,
  unreadThreads: 0,
};

function condo(name: string, pendencies: Partial<Pendencies> = {}): StreetCondo {
  return {
    id: name,
    name,
    role: 'admin',
    condoRole: 'administrador',
    permissions: [],
    hasHome: false,
    organizationId: 'o1',
    orgRole: null,
    onboardingPending: false,
    pendencies: { ...none, ...pendencies },
    windows: [],
  };
}

describe('reasonsOf', () => {
  test.each([
    ['overdueResidents', 1, 'urgente', '1 morador com taxa vencida', '1 atrasado'],
    ['overdueResidents', 3, 'urgente', '3 moradores com taxa vencida', '3 atrasados'],
    ['overdueAccounts', 1, 'urgente', '1 conta vencida', '1 vencida'],
    ['overdueAccounts', 2, 'urgente', '2 contas vencidas', '2 vencidas'],
    ['accountsDueSoon', 1, 'atencao', '1 conta vence em até 3 dias', 'vence em breve'],
    ['accountsDueSoon', 4, 'atencao', '4 contas vencem em até 3 dias', 'vence em breve'],
    ['proofsToReview', 1, 'atencao', '1 comprovante de Pix pra conferir', '1 comprov.'],
    ['proofsToReview', 5, 'atencao', '5 comprovantes de Pix pra conferir', '5 comprov.'],
  ] as const)('%s x%i', (key, count, level, text, flag) => {
    const [reason] = reasonsOf({ ...none, [key]: count });

    expect(reason).toMatchObject({ level, count, text, flag });
  });

  test('returns only counts above zero, in kind order', () => {
    const reasons = reasonsOf({
      overdueResidents: 0,
      overdueAccounts: 2,
      accountsDueSoon: 1,
      proofsToReview: 0,
      unreadThreads: 3,
    });

    expect(reasons.map((r) => r.kind)).toEqual(['overdue_accounts', 'accounts_due_soon']);
  });

  test('unread threads never raise a flag', () => {
    const pendencies = { ...none, unreadThreads: 4 };

    expect(reasonsOf(pendencies)).toEqual([]);
    expect(levelOf(pendencies)).toBeNull();
    expect(
      sortByUrgency([condo('B', { unreadThreads: 9 }), condo('A', { overdueAccounts: 1 })]).map(
        (c) => c.name,
      ),
    ).toEqual(['A', 'B']);
    expect(
      sortByUrgency([condo('Zeta', { unreadThreads: 9 }), condo('Alfa')]).map((c) => c.name),
    ).toEqual(['Alfa', 'Zeta']);
  });

  test('is empty without pendencies', () => {
    expect(reasonsOf(none)).toEqual([]);
  });
});

describe('levelOf', () => {
  test('is null without pendencies', () => {
    expect(levelOf(none)).toBeNull();
  });

  test('is the level of the first reason', () => {
    expect(levelOf({ ...none, accountsDueSoon: 2, overdueResidents: 1 })).toBe('urgente');
    expect(levelOf({ ...none, accountsDueSoon: 2 })).toBe('atencao');
  });
});

describe('sortByUrgency', () => {
  test('orders urgente, atencao, then none', () => {
    const sorted = sortByUrgency([
      condo('A'),
      condo('B', { accountsDueSoon: 1 }),
      condo('C', { overdueAccounts: 1 }),
    ]);

    expect(sorted.map((c) => c.name)).toEqual(['C', 'B', 'A']);
  });

  test('ties break by total count descending', () => {
    const sorted = sortByUrgency([
      condo('A', { overdueAccounts: 1 }),
      condo('B', { overdueAccounts: 1, accountsDueSoon: 3 }),
    ]);

    expect(sorted.map((c) => c.name)).toEqual(['B', 'A']);
  });

  test('then by name in pt-BR', () => {
    const sorted = sortByUrgency([condo('Zeta'), condo('Álamo'), condo('Beta')]);

    expect(sorted.map((c) => c.name)).toEqual(['Álamo', 'Beta', 'Zeta']);
  });

  test('does not mutate the input', () => {
    const input = [condo('B'), condo('A')];

    sortByUrgency(input);

    expect(input.map((c) => c.name)).toEqual(['B', 'A']);
  });
});

describe('greeting', () => {
  test.each([
    [4, 'Boa noite'],
    [5, 'Bom dia'],
    [11, 'Bom dia'],
    [12, 'Boa tarde'],
    [17, 'Boa tarde'],
    [18, 'Boa noite'],
  ])('hour %i is %s', (hour, expected) => {
    expect(greeting(hour, null)).toBe(expected);
  });

  test('uses the first name', () => {
    expect(greeting(9, 'Lucas Dantas')).toBe('Bom dia, Lucas');
  });

  test('ignores a blank name', () => {
    expect(greeting(9, '   ')).toBe('Bom dia');
  });
});

describe('summaryLine', () => {
  test.each([
    [1, 0, '1 condomínio · nada pede atenção hoje'],
    [3, 0, '3 condomínios · nada pede atenção hoje'],
    [3, 1, '3 condomínios · 1 pede atenção hoje'],
    [3, 2, '3 condomínios · 2 pedem atenção hoje'],
  ])('%i/%i', (total, attention, expected) => {
    expect(summaryLine(total, attention)).toBe(expected);
  });
});

describe('miniBuilding', () => {
  test('is empty without windows', () => {
    expect(miniBuilding([])).toEqual([]);
  });

  test('groups by block in order of appearance, top floor first', () => {
    const result = miniBuilding([
      { block: null, floor: 1, position: 1, lit: true },
      { block: 'A', floor: 1, position: 1, lit: false },
      { block: 'A', floor: 1, position: 2, lit: true },
      { block: 'A', floor: 2, position: 1, lit: true },
      { block: 'B', floor: 1, position: 1, lit: false },
    ]);

    expect(result).toEqual([
      { block: null, floors: [[true]] },
      {
        block: 'A',
        floors: [
          [true, false],
          [false, true],
        ],
      },
      { block: 'B', floors: [[false]] },
    ]);
  });

  test('fills position holes with false and skips empty floors', () => {
    const result = miniBuilding([
      { block: null, floor: 1, position: 1, lit: true },
      { block: null, floor: 3, position: 3, lit: true },
    ]);

    expect(result).toEqual([
      {
        block: null,
        floors: [
          [false, false, true],
          [true, false, false],
        ],
      },
    ]);
  });
});
