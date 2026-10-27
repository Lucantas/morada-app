import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Resident } from '@/features/residents/domain/resident';
import { buildResident } from '@/test/factories';
import { renderWithClient } from '@/test/render';

import { ResidentSheet } from './resident-sheet';

function AccessCardStub({
  residentId,
  residentEmail,
}: {
  residentId: string;
  residentEmail: string;
}) {
  return <p>{`Acesso de ${residentId} (${residentEmail})`}</p>;
}

function fakeResidents(overrides: Partial<{ save: jest.Mock; getById: jest.Mock }> = {}) {
  return {
    save: jest.fn(async (resident: Resident) => resident),
    getById: jest.fn(async () => buildResident({ id: 'r-9', email: 'bia@exemplo.com' })),
    ...overrides,
  };
}

function renderSheet(
  apartment = { label: 'Apto 101', residentId: null as string | null },
  residents = fakeResidents(),
) {
  const props = {
    apartment,
    residents,
    invitations: { invitation: jest.fn(), invite: jest.fn(), revoke: jest.fn() },
    accessCard: AccessCardStub,
    onSaved: jest.fn(),
    onClose: jest.fn(),
  };
  renderWithClient(<ResidentSheet {...props} />);
  return props;
}

describe('ResidentSheet', () => {
  test('saves the resident on the apartment and shows the access card', async () => {
    const user = userEvent.setup();
    const props = renderSheet();

    await user.type(screen.getByLabelText('Nome'), ' Ana ');
    await user.type(screen.getByLabelText('Telefone'), '21999990000');
    await user.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(props.residents.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ana',
        apt: 'Apto 101',
        phone: '21999990000',
        email: 'ana@exemplo.com',
        status: 'em_dia',
      }),
    );
    const saved = props.residents.save.mock.calls[0]?.[0];
    expect(await screen.findByText(`Acesso de ${saved?.id} (ana@exemplo.com)`)).toBeInTheDocument();
    expect(screen.getByText('Acesso do morador')).toBeInTheDocument();
    expect(props.onSaved).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(props.onClose).toHaveBeenCalled();
  });

  test('requires a name', async () => {
    const user = userEvent.setup();
    const props = renderSheet();

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Informe o nome do morador.');
    expect(props.residents.save).not.toHaveBeenCalled();
  });

  test('shows an error when saving fails', async () => {
    const user = userEvent.setup();
    renderSheet(
      { label: 'Apto 101', residentId: null },
      fakeResidents({ save: jest.fn().mockRejectedValue(new Error('falhou')) }),
    );

    await user.type(screen.getByLabelText('Nome'), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível salvar o morador. Tente de novo.',
    );
  });

  test('cancel closes an empty sheet', async () => {
    const user = userEvent.setup();
    const props = renderSheet();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(props.onClose).toHaveBeenCalled();
  });

  test('an occupied apartment opens on the access card', async () => {
    renderSheet({ label: 'Apto 102', residentId: 'r-9' });

    expect(await screen.findByText('Acesso de r-9 (bia@exemplo.com)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument();
  });

  test('an occupied apartment whose resident cannot load shows an error', async () => {
    renderSheet(
      { label: 'Apto 102', residentId: 'r-9' },
      fakeResidents({ getById: jest.fn().mockRejectedValue(new Error('falhou')) }),
    );

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar o morador.'),
    );
  });
});
