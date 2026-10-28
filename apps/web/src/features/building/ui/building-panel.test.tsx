import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { clearTestCondo, setTestCondo } from '@/test/condo';
import { renderWithClient } from '@/test/render';

import { InMemoryBuildingRepository } from '../data/in-memory-building-repository';
import type { BuildingRepository } from '../domain/building-repository';

import { BuildingPanel } from './building-panel';

beforeEach(() => setTestCondo());
afterEach(() => clearTestCondo());

describe('BuildingPanel', () => {
  test('shows the building with the ground content', async () => {
    const repository = new InMemoryBuildingRepository();
    await repository.addApartment({ label: 'Apto 101', block: null, floor: 1 });

    renderWithClient(
      <BuildingPanel
        repository={repository}
        onSelectApartment={jest.fn()}
        ground={<p>Térreo</p>}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Apto 101 · vazio' })).toBeVisible();
    expect(screen.getByText('Térreo')).toBeVisible();
  });

  test('reports the tapped apartment', async () => {
    const repository = new InMemoryBuildingRepository();
    await repository.addApartment({ label: 'Apto 101', block: null, floor: 1 });
    const onSelect = jest.fn();
    renderWithClient(<BuildingPanel repository={repository} onSelectApartment={onSelect} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Apto 101 · vazio' }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ label: 'Apto 101' }));
  });

  test('shows a loading state first', () => {
    const repository: BuildingRepository = {
      get: () => new Promise(() => {}),
    } as unknown as BuildingRepository;

    renderWithClient(<BuildingPanel repository={repository} onSelectApartment={jest.fn()} />);

    expect(screen.getByRole('status')).toBeVisible();
  });

  test('shows an explicit error with retry', async () => {
    const get = jest
      .fn()
      .mockRejectedValueOnce(new Error('falhou'))
      .mockResolvedValue({ blocks: [], unplaced: [] });
    const repository = { get } as unknown as BuildingRepository;
    renderWithClient(<BuildingPanel repository={repository} onSelectApartment={jest.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o prédio.',
    );
    await userEvent.click(screen.getByRole('button', { name: /tentar de novo/i }));

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });
});
