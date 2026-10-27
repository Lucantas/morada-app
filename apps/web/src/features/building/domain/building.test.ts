import { buildingSchema, countApartments } from './building';

const apartment = (id: string) => ({
  id,
  label: `Apto ${id}`,
  state: 'vazio' as const,
  residentId: null,
  residentName: null,
});

describe('building', () => {
  test('countApartments counts placed and unplaced apartments', () => {
    const building = buildingSchema.parse({
      blocks: [
        {
          name: null,
          floors: [
            { floor: 2, apartments: [apartment('201'), apartment('202')] },
            { floor: 1, apartments: [apartment('101')] },
          ],
        },
      ],
      unplaced: [apartment('loja')],
    });

    expect(countApartments(building)).toBe(4);
  });

  test('rejects an unknown apartment state', () => {
    const result = buildingSchema.safeParse({
      blocks: [],
      unplaced: [{ ...apartment('1'), state: 'quebrado' }],
    });

    expect(result.success).toBe(false);
  });
});
