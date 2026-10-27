import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { InMemoryResidentRepository } from '@/features/residents/data/in-memory-resident-repository';
import { useCondoScope } from '@/shared/lib/condo-scope';
import { buildResident } from '@/test/factories';
import {
  CREATED_INVITATION,
  PENDING_INVITATION,
  fakeInvitationRepository,
} from '@/test/factories.invitations';
import { renderWithClient } from '@/test/render';

import { InvitationError } from '../domain/errors';

import { ResidentAccessScreen } from './resident-access-screen';
import { testCondo } from '@/test/condo';

const RESIDENT = buildResident({ id: 'r-1', name: 'Ana Souza', email: 'ana@exemplo.com' });

function renderAccess(repository = fakeInvitationRepository(), resident = RESIDENT) {
  const props = {
    residentId: resident.id,
    repository,
    residents: new InMemoryResidentRepository([resident]),
    onBack: jest.fn(),
  };
  renderWithClient(<ResidentAccessScreen {...props} />);
  return props;
}

beforeEach(() => useCondoScope.getState().setCondo(testCondo({ name: 'Morada' })));

describe('ResidentAccessScreen', () => {
  test('shows a skeleton while the invitation loads', () => {
    renderAccess(
      fakeInvitationRepository({
        invitation: jest.fn().mockReturnValue(new Promise(() => {})),
      }),
    );

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  test('without an invite it offers the e-mail prefilled from the resident', async () => {
    const { repository } = renderAccess();
    const user = userEvent.setup();

    const email = await screen.findByLabelText('E-mail do morador');
    expect(email).toHaveValue('ana@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Gerar convite' }));

    expect(repository.invite).toHaveBeenCalledWith('r-1', 'ana@exemplo.com');
  });

  test('a link-only invite sends an empty e-mail', async () => {
    const { repository } = renderAccess();
    const user = userEvent.setup();

    await user.clear(await screen.findByLabelText('E-mail do morador'));
    await user.click(screen.getByRole('button', { name: 'Gerar convite' }));

    expect(repository.invite).toHaveBeenCalledWith('r-1', '');
  });

  test('rejects an invalid e-mail before calling the API', async () => {
    const { repository } = renderAccess();
    const user = userEvent.setup();

    const email = await screen.findByLabelText('E-mail do morador');
    await user.clear(email);
    await user.type(email, 'ana');
    await user.click(screen.getByRole('button', { name: 'Gerar convite' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Informe um e-mail válido.');
    expect(repository.invite).not.toHaveBeenCalled();
  });

  test('after creation it offers WhatsApp, e-mail and the copyable link', async () => {
    const open = jest.spyOn(window, 'open').mockReturnValue(null);
    renderAccess();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Gerar convite' }));

    expect(await screen.findByTestId('invite-link')).toHaveTextContent(CREATED_INVITATION.link);
    expect(screen.getByText('Enviar por e-mail')).toBeInTheDocument();
    expect(screen.getByText('E-mail enviado para ana@exemplo.com')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enviar pelo WhatsApp' }));
    expect(open).toHaveBeenCalledWith(CREATED_INVITATION.whatsappUrl, '_blank', 'noopener');
    open.mockRestore();
  });

  test('copies the link to the clipboard', async () => {
    renderAccess();
    const user = userEvent.setup();
    const writeText = jest.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

    await user.click(await screen.findByRole('button', { name: 'Gerar convite' }));
    await user.click(await screen.findByRole('button', { name: 'Copiar link' }));

    expect(writeText).toHaveBeenCalledWith(CREATED_INVITATION.link);
    expect(await screen.findByRole('button', { name: 'Link copiado!' })).toBeInTheDocument();
  });

  test('an e-mail that could not be sent points to WhatsApp or the link', async () => {
    renderAccess(
      fakeInvitationRepository({
        invite: jest.fn().mockResolvedValue({ ...CREATED_INVITATION, emailSent: false }),
      }),
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Gerar convite' }));

    expect(
      await screen.findByText(
        'Não foi possível enviar o e-mail agora. Envie pelo WhatsApp ou copie o link.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/E-mail enviado para/)).not.toBeInTheDocument();
  });

  test('a failed copy is explained', async () => {
    renderAccess();
    const user = userEvent.setup();
    jest.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));

    await user.click(await screen.findByRole('button', { name: 'Gerar convite' }));
    await user.click(await screen.findByRole('button', { name: 'Copiar link' }));

    expect(
      await screen.findByRole('button', { name: 'Não foi possível copiar' }),
    ).toBeInTheDocument();
  });

  test('a link-only invite hides the e-mail action', async () => {
    renderAccess(
      fakeInvitationRepository({
        invite: jest.fn().mockResolvedValue({ ...CREATED_INVITATION, email: null }),
      }),
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Gerar convite' }));

    expect(await screen.findByTestId('invite-link')).toBeInTheDocument();
    expect(screen.queryByText('Enviar por e-mail')).not.toBeInTheDocument();
  });

  test('a pending invite shows its expiry, the forwarding note, resend and revoke', async () => {
    const { repository } = renderAccess(
      fakeInvitationRepository({ invitation: jest.fn().mockResolvedValue(PENDING_INVITATION) }),
    );
    const user = userEvent.setup();

    expect(await screen.findByText('Convite pendente · vence em 30/10')).toBeInTheDocument();
    expect(screen.getByText('Convite para ana@exemplo.com')).toBeInTheDocument();
    expect(
      screen.getByText('Se o link foi repassado para outra pessoa, gere um novo convite.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reenviar' }));

    expect(repository.invite).toHaveBeenCalledWith('r-1', 'ana@exemplo.com');
    expect(await screen.findByTestId('invite-link')).toBeInTheDocument();
  });

  test('revoking asks for confirmation first', async () => {
    const repository = fakeInvitationRepository({
      invitation: jest.fn().mockResolvedValue(PENDING_INVITATION),
    });
    renderAccess(repository);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Revogar' }));
    const dialog = screen.getByRole('dialog');
    expect(repository.revoke).not.toHaveBeenCalled();
    repository.invitation.mockResolvedValue({ ...PENDING_INVITATION, status: 'revogado' });
    await user.click(within(dialog).getByRole('button', { name: 'Revogar convite' }));

    expect(repository.revoke).toHaveBeenCalledWith('r-1');
    expect(await screen.findByText('Convite revogado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar novo convite' })).toBeInTheDocument();
  });

  test('a failed revoke closes the dialog and shows the error', async () => {
    renderAccess(
      fakeInvitationRepository({
        invitation: jest.fn().mockResolvedValue(PENDING_INVITATION),
        revoke: jest.fn().mockRejectedValue(new InvitationError('unavailable')),
      }),
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Revogar' }));
    await user.click(screen.getByRole('button', { name: 'Revogar convite' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível concluir. Verifique a conexão com o servidor.',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('cancelling the revoke keeps the invite', async () => {
    const { repository } = renderAccess(
      fakeInvitationRepository({ invitation: jest.fn().mockResolvedValue(PENDING_INVITATION) }),
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Revogar' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(repository.revoke).not.toHaveBeenCalled();
  });

  test('an accepted invite shows the active access', async () => {
    renderAccess(
      fakeInvitationRepository({
        invitation: jest.fn().mockResolvedValue({ ...PENDING_INVITATION, status: 'aceito' }),
      }),
    );

    expect(await screen.findByText('Acesso ativo por e-mail')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /convite/ })).not.toBeInTheDocument();
  });

  test('an expired invite offers a new one', async () => {
    const { repository } = renderAccess(
      fakeInvitationRepository({
        invitation: jest.fn().mockResolvedValue({ ...PENDING_INVITATION, status: 'expirado' }),
      }),
    );
    const user = userEvent.setup();

    expect(await screen.findByText('Convite expirado')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Gerar novo convite' }));

    expect(repository.invite).toHaveBeenCalledWith('r-1', 'ana@exemplo.com');
  });

  test.each([
    ['inactive-resident', 'Este morador não está mais ativo no apartamento.'],
    ['pending-conflict', 'Já existe um convite pendente. Atualize a tela.'],
    ['not-found', 'Morador não encontrado.'],
    ['unavailable', 'Não foi possível concluir. Verifique a conexão com o servidor.'],
  ] as const)('a %s failure explains itself', async (kind, message) => {
    renderAccess(
      fakeInvitationRepository({
        invite: jest.fn().mockRejectedValue(new InvitationError(kind)),
      }),
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Gerar convite' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  test('a failed load shows an error', async () => {
    renderAccess(
      fakeInvitationRepository({
        invitation: jest.fn().mockRejectedValue(new InvitationError('unavailable')),
      }),
    );

    expect(await screen.findByText('Não foi possível carregar o acesso.')).toBeInTheDocument();
  });

  test('a legacy login is shown with the password reset', async () => {
    const { repository } = renderAccess(
      fakeInvitationRepository({ legacyLogin: jest.fn().mockResolvedValue('ana302') }),
    );
    const user = userEvent.setup();

    expect(await screen.findByTestId('login-username')).toHaveTextContent('ana302');
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    expect(repository.resetLegacyLogin).toHaveBeenCalledWith('r-1');
    expect(await screen.findByTestId('temp-password')).toHaveTextContent('Temp1234');
  });

  test('a failed legacy reset explains itself', async () => {
    renderAccess(
      fakeInvitationRepository({
        legacyLogin: jest.fn().mockResolvedValue('ana302'),
        resetLegacyLogin: jest.fn().mockRejectedValue(new InvitationError('unavailable')),
      }),
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Redefinir senha' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível redefinir a senha.',
    );
  });

  test('an accepted invite hides the retired legacy login', async () => {
    const { repository } = renderAccess(
      fakeInvitationRepository({
        invitation: jest.fn().mockResolvedValue({ ...PENDING_INVITATION, status: 'aceito' }),
        legacyLogin: jest.fn().mockResolvedValue('ana302'),
      }),
    );

    expect(await screen.findByText('Acesso ativo por e-mail')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Redefinir senha' })).not.toBeInTheDocument();
    expect(repository.legacyLogin).not.toHaveBeenCalled();
  });

  test('without a legacy login there is no reset', async () => {
    renderAccess();

    await screen.findByRole('button', { name: 'Gerar convite' });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Redefinir senha' })).not.toBeInTheDocument(),
    );
  });

  test('shows the resident name and goes back', async () => {
    const { onBack } = renderAccess();
    const user = userEvent.setup();

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('Acesso do morador · Morada')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Voltar' }));

    expect(onBack).toHaveBeenCalled();
  });
});
