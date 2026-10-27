import { createCondoInputSchema } from './create-condo';

const BLOCK = { name: null, floors: 4, perFloor: 4 };

describe('createCondoInputSchema', () => {
  test('fills the API defaults for fee, due day and pix', () => {
    expect(createCondoInputSchema.parse({ name: '  Residencial Ipê ' })).toEqual({
      name: 'Residencial Ipê',
      monthlyFeeCents: 0,
      dueDay: 10,
      pix: null,
    });
  });

  test('accepts a single unnamed block', () => {
    const parsed = createCondoInputSchema.parse({ name: 'Ipê', structure: { blocks: [BLOCK] } });

    expect(parsed.structure).toEqual({ blocks: [BLOCK] });
  });

  test('rejects an unnamed block among several', () => {
    const blocks = [BLOCK, { ...BLOCK, name: 'B' }];

    expect(createCondoInputSchema.safeParse({ name: 'Ipê', structure: { blocks } }).success).toBe(
      false,
    );
  });

  test('rejects block names that differ only by case', () => {
    const blocks = [
      { ...BLOCK, name: 'a' },
      { ...BLOCK, name: 'A' },
    ];

    expect(createCondoInputSchema.safeParse({ name: 'Ipê', structure: { blocks } }).success).toBe(
      false,
    );
  });

  test('rejects more than 2000 apartments in total', () => {
    const blocks = ['A', 'B', 'C'].map((name) => ({ name, floors: 60, perFloor: 20 }));

    expect(createCondoInputSchema.safeParse({ name: 'Ipê', structure: { blocks } }).success).toBe(
      false,
    );
  });

  test('rejects out-of-range floors, fee and due day', () => {
    const tooTall = { blocks: [{ ...BLOCK, floors: 61 }] };

    expect(createCondoInputSchema.safeParse({ name: 'Ipê', structure: tooTall }).success).toBe(
      false,
    );
    expect(createCondoInputSchema.safeParse({ name: 'Ipê', monthlyFeeCents: -1 }).success).toBe(
      false,
    );
    expect(createCondoInputSchema.safeParse({ name: 'Ipê', dueDay: 29 }).success).toBe(false);
  });
});
