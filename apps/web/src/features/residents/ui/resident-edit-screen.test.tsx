import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithClient } from '@/test/render';
import { buildResident } from '@/test/factories';

import { InMemoryResidentRepository } from '../data/in-memory-resident-repository';

import { ResidentEditScreen } from './resident-edit-screen';

describe('ResidentEditScreen', () => {
  test('creates a new resident and navigates back', async () => {
    const repository = new InMemoryResidentRepository([]);
    const onBack = jest.fn();
    renderWithClient(<ResidentEditScreen repository={repository} onBack={onBack} />);

    await userEvent.type(screen.getByLabelText('Nome completo'), 'Carla Dias');
    await userEvent.type(screen.getByLabelText('Apartamento'), 'Apto 101');
    await userEvent.click(screen.getByRole('button', { name: /cadastrar morador/i }));

    await waitFor(() => expect(onBack).toHaveBeenCalled());
    const saved = await repository.list();
    expect(saved.map((r) => r.name)).toContain('Carla Dias');
  });

  test('prefills the form when editing an existing resident', async () => {
    const repository = new InMemoryResidentRepository([
      buildResident({ id: 'r-7', name: 'Diego Reis', apt: 'Apto 202' }),
    ]);
    renderWithClient(
      <ResidentEditScreen repository={repository} residentId="r-7" onBack={jest.fn()} />,
    );

    expect(await screen.findByDisplayValue('Diego Reis')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Apto 202')).toBeInTheDocument();
  });
});
