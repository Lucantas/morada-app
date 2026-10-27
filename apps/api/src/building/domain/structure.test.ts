import { generateApartments, structureSchema } from './structure';

describe('generateApartments', () => {
  test('single building numbers floors from 1', () => {
    const structure = structureSchema.parse({ blocks: [{ name: null, floors: 2, perFloor: 3 }] });

    const apartments = generateApartments(structure);

    expect(apartments.map((a) => a.label)).toEqual([
      'Apto 101',
      'Apto 102',
      'Apto 103',
      'Apto 201',
      'Apto 202',
      'Apto 203',
    ]);
    expect(apartments.every((a) => a.block === null)).toBe(true);
    expect(apartments.map((a) => a.position)).toEqual([1, 2, 3, 1, 2, 3]);
    expect(apartments.map((a) => a.floor)).toEqual([1, 1, 1, 2, 2, 2]);
  });

  test('twelve floors pad the position', () => {
    const structure = structureSchema.parse({ blocks: [{ name: null, floors: 12, perFloor: 8 }] });

    const apartments = generateApartments(structure);

    expect(apartments.map((a) => a.label)).toContain('Apto 1208');
    expect(apartments).toHaveLength(96);
  });

  test('blocks qualify the label', () => {
    const structure = structureSchema.parse({
      blocks: [
        { name: 'A', floors: 1, perFloor: 2 },
        { name: 'B', floors: 1, perFloor: 1 },
      ],
    });

    const apartments = generateApartments(structure);

    expect(apartments.map((a) => a.label)).toEqual([
      'Apto 101 · Bloco A',
      'Apto 102 · Bloco A',
      'Apto 101 · Bloco B',
    ]);
    expect(apartments.map((a) => a.block)).toEqual(['A', 'A', 'B']);
  });
});

describe('structureSchema', () => {
  const block = { name: 'A', floors: 1, perFloor: 1 };

  test.each([
    [
      'a null name with two blocks',
      {
        blocks: [
          { ...block, name: null },
          { ...block, name: 'B' },
        ],
      },
    ],
    [
      'duplicate names',
      {
        blocks: [
          { ...block, name: 'a' },
          { ...block, name: 'A' },
        ],
      },
    ],
    ['11 blocks', { blocks: Array.from({ length: 11 }, (_, i) => ({ ...block, name: `B${i}` })) }],
    ['61 floors', { blocks: [{ ...block, floors: 61 }] }],
    ['21 per floor', { blocks: [{ ...block, perFloor: 21 }] }],
    [
      'a total of 2200',
      {
        blocks: Array.from({ length: 10 }, (_, i) => ({
          name: `B${i}`,
          floors: 11,
          perFloor: 20,
        })),
      },
    ],
    ['no blocks', { blocks: [] }],
  ])('rejects %s', (_, body) => {
    expect(structureSchema.safeParse(body).success).toBe(false);
  });

  test('accepts exactly 2000 apartments', () => {
    const body = {
      blocks: Array.from({ length: 10 }, (_, i) => ({ name: `B${i}`, floors: 10, perFloor: 20 })),
    };

    expect(structureSchema.safeParse(body).success).toBe(true);
  });
});
