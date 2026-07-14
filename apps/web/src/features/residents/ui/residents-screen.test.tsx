import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithClient } from '@/test/render';
import { buildResident } from '@/test/factories';

import { InMemoryResidentRepository } from '../data/in-memory-resident-repository';

import { ResidentsScreen } from './residents-screen';

function setup() {
  const repository = new InMemoryResidentRepository([
    buildResident({ id: 'r-1', name: 'Ana Souza', apt: 'Apto 101', status: 'em_dia' }),
    buildResident({ id: 'r-2', name: 'Bruno Lima', apt: 'Apto 202', status: 'pendente' }),
  ]);
  const onOpenResident = jest.fn();
  renderWithClient(
    <ResidentsScreen repository={repository} onOpenResident={onOpenResident} bottomNav={null} />,
  );
  return { onOpenResident };
}

describe('ResidentsScreen', () => {
  test('renders each apartment with its resident once loaded', async () => {
    setup();

    expect(await screen.findByText('Apto 101')).toBeInTheDocument();
    expect(screen.getByText('Apto 202')).toBeInTheDocument();
    expect(screen.getByText(/Ana Souza/)).toBeInTheDocument();
  });

  test('shows the stat cards for apartments and pendências', async () => {
    setup();

    await screen.findByText('Apto 101');
    expect(screen.getAllByText('Apartamentos').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Pendências')).toBeInTheDocument();
  });

  test('opening the new-apartment form calls back with no id', async () => {
    const { onOpenResident } = setup();
    await screen.findByText('Apto 101');

    await userEvent.click(screen.getByRole('button', { name: /cadastrar apartamento/i }));

    expect(onOpenResident).toHaveBeenCalledWith();
  });

  test('clicking an apartment opens it by id', async () => {
    const { onOpenResident } = setup();

    await userEvent.click(await screen.findByText(/Ana Souza/));

    await waitFor(() => expect(onOpenResident).toHaveBeenCalledWith('r-1'));
  });

  test('the search box filters the list by resident name', async () => {
    setup();
    await screen.findByText(/Ana Souza/);

    await userEvent.type(screen.getByLabelText('Buscar morador ou apartamento'), 'bruno');

    expect(screen.getByText(/Bruno Lima/)).toBeInTheDocument();
    expect(screen.queryByText(/Ana Souza/)).not.toBeInTheDocument();
  });
});
