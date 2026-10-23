import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useCondoScope } from '@/shared/lib/condo-scope';
import { testCondo } from '@/test/condo';
import {
  CREATED_INVITATION,
  CURRENT_SINDICO,
  PENDING_SINDICO,
  fakeInvitationRepository,
} from '@/test/factories.invitations';
import { renderWithClient } from '@/test/render';

import { InvitationError } from '../domain/errors';

import { SindicoScreen } from './sindico-screen';

function renderSindico(repository = fakeInvitationRepository()) {
  const props = { repository, onBack: jest.fn() };
  renderWithClient(<SindicoScreen {...props} />);
  return props;
}

beforeEach(() => useCondoScope.getState().setCondo(testCondo({ name: 'Morada' })));

describe('SindicoScreen', () => {
  test('requires an e-mail to invite', async () => {
    const { repository } = renderSindico();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Gerar convite' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Informe o e-mail do síndico');
    expect(repository.inviteSindico).not.toHaveBeenCalled();
  });

  test('invites with e-mail and optional phone and shows the share card', async () => {
    const { repository } = renderSindico();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('E-mail do síndico'), 'Carla@Exemplo.com');
    await user.type(screen.getByLabelText('Telefone (opcional)'), '21999990000');
    await user.click(screen.getByRole('button', { name: 'Gerar convite' }));

    expect(repository.inviteSindico).toHaveBeenCalledWith('carla@exemplo.com', '21999990000');
    expect(await screen.findByTestId('invite-link')).toHaveTextContent(CREATED_INVITATION.link);
  });

  test('invites without a phone', async () => {
    const { repository } = renderSindico();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('E-mail do síndico'), 'carla@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Gerar convite' }));

    expect(repository.inviteSindico).toHaveBeenCalledWith('carla@exemplo.com', undefined);
  });

  test('shows a friendly error when the invite fails', async () => {
    const { repository } = renderSindico(
      fakeInvitationRepository({
        inviteSindico: jest.fn().mockRejectedValue(new InvitationError('rate-limited')),
      }),
    );
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('E-mail do síndico'), 'carla@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Gerar convite' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Muitas tentativas, tente mais tarde.',
    );
    expect(repository.inviteSindico).toHaveBeenCalled();
  });

  test('shows the current síndico and removes after confirm', async () => {
    const { repository } = renderSindico(
      fakeInvitationRepository({ sindico: jest.fn().mockResolvedValue(CURRENT_SINDICO) }),
    );
    const user = userEvent.setup();

    expect(await screen.findByText('Carla Lima')).toBeInTheDocument();
    expect(screen.getByText('carla@exemplo.com')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remover síndico' }));
    expect(repository.removeSindico).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Remover síndico' }));

    await waitFor(() => expect(repository.removeSindico).toHaveBeenCalledTimes(1));
  });

  test('cancelling the confirm keeps the síndico', async () => {
    const { repository } = renderSindico(
      fakeInvitationRepository({ sindico: jest.fn().mockResolvedValue(CURRENT_SINDICO) }),
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Remover síndico' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: /cancelar/i }),
    );

    expect(repository.removeSindico).not.toHaveBeenCalled();
  });

  test('falls back to the e-mail when the síndico has no name', async () => {
    renderSindico(
      fakeInvitationRepository({
        sindico: jest
          .fn()
          .mockResolvedValue({ current: { name: null, email: 'c@x.com' }, invitation: null }),
      }),
    );

    expect(await screen.findByText('c@x.com')).toBeInTheDocument();
  });

  const pendingWithCurrent = () =>
    fakeInvitationRepository({
      sindico: jest.fn().mockResolvedValue({
        current: CURRENT_SINDICO.current,
        invitation: PENDING_SINDICO.invitation,
      }),
    });

  test('a pending invite can be resent', async () => {
    const { repository } = renderSindico(pendingWithCurrent());
    const user = userEvent.setup();

    expect(await screen.findByText(/Convite pendente/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reenviar' }));

    expect(repository.inviteSindico).toHaveBeenCalledWith('ana@exemplo.com', undefined);
    expect(await screen.findByTestId('invite-link')).toBeInTheDocument();
  });

  test('revoking a pending invite does not remove the current síndico', async () => {
    const { repository } = renderSindico(pendingWithCurrent());
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Revogar' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Revogar convite' }),
    );

    await waitFor(() => expect(repository.revokeSindico).toHaveBeenCalledTimes(1));
    expect(repository.removeSindico).not.toHaveBeenCalled();
  });

  test('offers a new invite after an expired one', async () => {
    renderSindico(
      fakeInvitationRepository({
        sindico: jest.fn().mockResolvedValue({
          current: null,
          invitation: { ...PENDING_SINDICO.invitation, status: 'expirado' },
        }),
      }),
    );

    expect(await screen.findByText('Convite expirado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar novo convite' })).toBeInTheDocument();
  });

  test('shows an error state when loading fails', async () => {
    renderSindico(
      fakeInvitationRepository({ sindico: jest.fn().mockRejectedValue(new Error('x')) }),
    );

    expect(await screen.findByText('Não foi possível carregar o síndico.')).toBeInTheDocument();
  });

  test('goes back', async () => {
    const { onBack } = renderSindico();

    await userEvent.click(await screen.findByRole('button', { name: 'Voltar' }));

    expect(onBack).toHaveBeenCalled();
  });
});
