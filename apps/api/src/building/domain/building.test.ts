import { buildBuildingView, type PlacedApartment } from './building';

const placed = (
  label: string,
  block: string | null,
  floor: number | null,
  position: number | null,
) => ({ id: `id-${label}`, label, block, floor, position }) satisfies PlacedApartment;

describe('buildBuildingView', () => {
  test('draws floors top-down', () => {
    const apartments = [
      placed('Apto 102', null, 1, 2),
      placed('Apto 201', null, 2, 1),
      placed('Apto 101', null, 1, 1),
      placed('Apto 202', null, 2, 2),
    ];

    const view = buildBuildingView(apartments, []);

    expect(view.blocks).toHaveLength(1);
    expect(view.blocks[0]?.floors.map((f) => f.floor)).toEqual([2, 1]);
    expect(view.blocks[0]?.floors[0]?.apartments.map((a) => a.label)).toEqual([
      'Apto 201',
      'Apto 202',
    ]);
  });

  test('maps occupant status to window state', () => {
    const apartments = [
      placed('Apto 101', null, 1, 1),
      placed('Apto 102', null, 1, 2),
      placed('Apto 103', null, 1, 3),
      placed('Apto 104', null, 1, 4),
    ];
    const occupants = [
      { apartmentId: 'id-Apto 101', residentId: 'r1', name: 'Ana', status: 'em_dia' as const },
      { apartmentId: 'id-Apto 102', residentId: 'r2', name: 'Bia', status: 'atrasado' as const },
      { apartmentId: 'id-Apto 103', residentId: 'r3', name: 'Caio', status: 'pendente' as const },
    ];

    const view = buildBuildingView(apartments, occupants);

    expect(view.blocks[0]?.floors[0]?.apartments).toEqual([
      {
        id: 'id-Apto 101',
        label: 'Apto 101',
        state: 'ocupado',
        residentId: 'r1',
        residentName: 'Ana',
      },
      {
        id: 'id-Apto 102',
        label: 'Apto 102',
        state: 'atrasado',
        residentId: 'r2',
        residentName: 'Bia',
      },
      {
        id: 'id-Apto 103',
        label: 'Apto 103',
        state: 'pendente',
        residentId: 'r3',
        residentName: 'Caio',
      },
      {
        id: 'id-Apto 104',
        label: 'Apto 104',
        state: 'vazio',
        residentId: null,
        residentName: null,
      },
    ]);
  });

  test('blocks are ordered and unplaced apartments are separate', () => {
    const apartments = [
      placed('Apto 101 · Bloco B', 'B', 1, 1),
      placed('Apto 101 · Bloco A', 'A', 1, 1),
      placed('Apto 101', null, 1, 1),
      placed('Loja', null, null, null),
      placed('Casa', null, null, null),
    ];

    const view = buildBuildingView(apartments, []);

    expect(view.blocks.map((b) => b.name)).toEqual([null, 'A', 'B']);
    expect(view.unplaced.map((a) => a.label)).toEqual(['Casa', 'Loja']);
  });
});
