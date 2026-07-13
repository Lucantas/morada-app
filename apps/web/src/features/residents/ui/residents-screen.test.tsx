import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithClient } from '@/test/render';
import { buildResident } from '@/test/factories';

import { InMemoryResidentRepository } from '../data/in-memory-resident-repository';

import { ResidentsScreen } from './residents-screen';

function setup() {
  const repository = new InMemoryResidentRepository([
    buildResident({ id: 'r-1', name: 'Ana Souza', status: 'em_dia' }),
    buildResident({ id: 'r-2', name: 'Bruno Lima', status: 'pendente' }),
  ]);
  const onOpenResident = jest.fn();
  renderWithClient(
    <ResidentsScreen repository={repository} onOpenResident={onOpenResident} bottomNav={null} />,
  );
  return { onOpenResident };
}

describe('ResidentsScreen', () => {
  test('renders the resident list once loaded', async () => {
    setup();

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('Bruno Lima')).toBeInTheDocument();
  });

  test('shows the stat cards for total and pendências', async () => {
    setup();

    await screen.findByText('Ana Souza');
    expect(screen.getAllByText('Moradores').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Pendências')).toBeInTheDocument();
  });

  test('opening the new-resident form calls back with no id', async () => {
    const { onOpenResident } = setup();
    await screen.findByText('Ana Souza');

    await userEvent.click(screen.getByRole('button', { name: /cadastrar morador/i }));

    expect(onOpenResident).toHaveBeenCalledWith();
  });

  test('clicking a resident opens it by id', async () => {
    const { onOpenResident } = setup();

    await userEvent.click(await screen.findByText('Ana Souza'));

    await waitFor(() => expect(onOpenResident).toHaveBeenCalledWith('r-1'));
  });

  test('the search box filters the list by name', async () => {
    setup();
    await screen.findByText('Ana Souza');

    await userEvent.type(screen.getByLabelText('Buscar morador ou apartamento'), 'bruno');

    expect(screen.getByText('Bruno Lima')).toBeInTheDocument();
    expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument();
  });
});
