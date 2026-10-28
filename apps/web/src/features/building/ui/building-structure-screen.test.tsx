import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { clearTestCondo, setTestCondo } from '@/test/condo';
import { renderWithClient } from '@/test/render';

import { InMemoryBuildingRepository } from '../data/in-memory-building-repository';
import { BuildingError } from '../domain/errors';
import type { BuildingRepository } from '../domain/building-repository';

import { BuildingStructureScreen } from './building-structure-screen';

beforeEach(() => setTestCondo());
afterEach(() => clearTestCondo());

async function seeded() {
  const repository = new InMemoryBuildingRepository();
  await repository.addApartment({ label: 'Apto 101', block: null, floor: 1 });
  return repository;
}

describe('BuildingStructureScreen', () => {
  test('renames an apartment', async () => {
    const repository = await seeded();
    renderWithClient(<BuildingStructureScreen repository={repository} onBack={jest.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Renomear Apto 101' }));
    const field = screen.getByLabelText('Novo nome');
    await userEvent.clear(field);
    await userEvent.type(field, 'Apto 102');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar nome' }));

    expect(await screen.findByText('Apto 102')).toBeVisible();
    expect(screen.queryByText('Apto 101')).not.toBeInTheDocument();
  });

  test('deactivating an occupied apartment shows "Apartamento com morador ativo"', async () => {
    const get = jest.fn().mockResolvedValue({
      blocks: [
        {
          name: null,
          floors: [
            {
              floor: 1,
              apartments: [
                {
                  id: 'a1',
                  label: 'Apto 101',
                  state: 'ocupado',
                  residentId: 'r1',
                  residentName: 'Lúcia',
                },
              ],
            },
          ],
        },
      ],
      unplaced: [],
    });
    const deactivateApartment = jest
      .fn()
      .mockRejectedValue(new BuildingError('conflict', 'Apartamento com morador ativo'));
    const repository = { get, deactivateApartment } as unknown as BuildingRepository;
    renderWithClient(<BuildingStructureScreen repository={repository} onBack={jest.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Desativar Apto 101' }));
    expect(
      screen.getByText('O Apto 101 sai do desenho do prédio. O histórico é preservado.'),
    ).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Desativar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Apartamento com morador ativo');
  });

  test('deactivates a vacant apartment', async () => {
    const repository = await seeded();
    renderWithClient(<BuildingStructureScreen repository={repository} onBack={jest.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Desativar Apto 101' }));
    await userEvent.click(screen.getByRole('button', { name: 'Desativar' }));

    await waitFor(() => expect(screen.queryByText('Apto 101')).not.toBeInTheDocument());
  });

  test('adds an apartment on a floor', async () => {
    const repository = new InMemoryBuildingRepository();
    renderWithClient(<BuildingStructureScreen repository={repository} onBack={jest.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: '+ Apartamento' }));
    await userEvent.type(screen.getByLabelText('Nome do apartamento'), 'Apto 201');
    await userEvent.type(screen.getByLabelText('Andar'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(await screen.findByText('Apto 201')).toBeVisible();
    expect(screen.getByText('Andar 2')).toBeVisible();
  });

  test('shows the conflict message when the name already exists', async () => {
    const repository = await seeded();
    renderWithClient(<BuildingStructureScreen repository={repository} onBack={jest.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: '+ Apartamento' }));
    await userEvent.type(screen.getByLabelText('Nome do apartamento'), 'Apto 101');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Já existe um apartamento com esse nome',
    );
  });

  test('shows the load error with retry', async () => {
    const get = jest
      .fn()
      .mockRejectedValueOnce(new Error('falhou'))
      .mockResolvedValue({ blocks: [], unplaced: [] });
    const repository = { get } as unknown as BuildingRepository;
    renderWithClient(<BuildingStructureScreen repository={repository} onBack={jest.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o prédio.',
    );
    await userEvent.click(screen.getByRole('button', { name: /tentar de novo/i }));

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  test('goes back', async () => {
    const onBack = jest.fn();
    renderWithClient(
      <BuildingStructureScreen repository={new InMemoryBuildingRepository()} onBack={onBack} />,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Voltar' }));

    expect(onBack).toHaveBeenCalled();
  });
});
