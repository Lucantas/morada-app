import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { buildingSchema, type BuildingApartment } from '../domain/building';

import { BuildingView } from './building-view';

const apartment = (
  label: string,
  state: BuildingApartment['state'] = 'vazio',
  residentName: string | null = null,
): BuildingApartment => ({
  id: label,
  label,
  state,
  residentId: residentName ? `r-${label}` : null,
  residentName,
});

const building = buildingSchema.parse({
  blocks: [
    {
      name: null,
      floors: [
        { floor: 2, apartments: [apartment('Apto 201'), apartment('Apto 202', 'atrasado', 'Bia')] },
        {
          floor: 1,
          apartments: [
            apartment('Apto 101', 'ocupado', 'Ana'),
            apartment('Apto 102', 'pendente', 'Caio'),
          ],
        },
      ],
    },
  ],
  unplaced: [apartment('Loja')],
});

describe('BuildingView', () => {
  test('renders one button per apartment top floor first', () => {
    render(<BuildingView building={building} onSelectApartment={jest.fn()} />);

    const labels = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));

    expect(labels[0]).toBe('Apto 201 · vazio');
    expect(labels).toHaveLength(5);
  });

  test('tapping a window reports it', async () => {
    const onSelect = jest.fn();
    render(<BuildingView building={building} onSelectApartment={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: 'Apto 101 · ocupado por Ana' }));

    expect(onSelect).toHaveBeenCalledWith(apartment('Apto 101', 'ocupado', 'Ana'));
  });

  test('occupied window names the resident', () => {
    render(<BuildingView building={building} onSelectApartment={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Apto 101 · ocupado por Ana' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apto 102 · pendente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apto 202 · atrasado' })).toBeInTheDocument();
  });

  test('unplaced apartments get their own row', () => {
    render(<BuildingView building={building} onSelectApartment={jest.fn()} />);

    expect(screen.getByText('Outras unidades')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Loja · vazio' })).toBeVisible();
  });

  test('omits the unplaced row when everything is placed', () => {
    render(<BuildingView building={{ ...building, unplaced: [] }} onSelectApartment={jest.fn()} />);

    expect(screen.queryByText('Outras unidades')).not.toBeInTheDocument();
  });

  test('renders ground content and the block names', () => {
    const named = { ...building, blocks: building.blocks.map((b) => ({ ...b, name: 'Bloco A' })) };
    render(
      <BuildingView
        building={named}
        onSelectApartment={jest.fn()}
        ground={<p>Térreo</p>}
        title="Meu prédio"
      />,
    );

    expect(screen.getByText('Térreo')).toBeVisible();
    expect(screen.getByText('Bloco A')).toBeVisible();
    expect(screen.getByText('Meu prédio')).toBeVisible();
  });
});
