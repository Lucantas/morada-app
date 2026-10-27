import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useCondoScope } from '@/shared/lib/condo-scope';
import { testCondo } from '@/test/condo';
import { CREATED_INVITATION } from '@/test/factories.invitations';
import { INVITE_SLOTS, fakeTeamRepository } from '@/test/factories.team';
import { renderWithClient } from '@/test/render';

import { TeamError } from '../domain/errors';

import { TeamScreen } from './team-screen';

function renderTeam(repository = fakeTeamRepository()) {
  const props = { repository, onBack: jest.fn(), ...INVITE_SLOTS };
  renderWithClient(<TeamScreen {...props} />);
  return props;
}

function memberRow(name: string) {
  const row = screen.getByText(name).closest('li');
  if (!row) throw new Error(`row not found: ${name}`);
  return within(row);
}

beforeEach(() => useCondoScope.getState().setCondo(testCondo()));
afterEach(() => useCondoScope.getState().setCondo(null));

describe('TeamScreen', () => {
  test('lists members with their condos checked', async () => {
    renderTeam();
    await screen.findByText('Bruno Alves');

    const row = memberRow('Bruno Alves');

    expect(row.getByRole('checkbox', { name: 'Condomínio Morada' })).toBeChecked();
    expect(row.getByRole('checkbox', { name: 'Edifício Sol' })).not.toBeChecked();
    expect(row.getByText('Administra')).toBeInTheDocument();
  });

  test('toggling a condo saves the full set', async () => {
    const { repository } = renderTeam();
    const user = userEvent.setup();
    await screen.findByText('Bruno Alves');

    await user.click(memberRow('Bruno Alves').getByRole('checkbox', { name: 'Edifício Sol' }));

    expect(repository.assignCondos).toHaveBeenCalledWith('u2', ['c1', 'c2']);
  });

  test('unchecking a condo saves the remaining set', async () => {
    const { repository } = renderTeam();
    const user = userEvent.setup();
    await screen.findByText('Bruno Alves');

    await user.click(memberRow('Bruno Alves').getByRole('checkbox', { name: 'Condomínio Morada' }));

    expect(repository.assignCondos).toHaveBeenCalledWith('u2', []);
  });

  test('owner rows have no deactivate button', async () => {
    renderTeam();
    await screen.findByText('Lúcia Dono');

    const row = memberRow('Lúcia Dono');

    expect(row.getByText('Dono · vê todos os condomínios')).toBeInTheDocument();
    expect(row.queryByRole('button', { name: 'Desativar' })).not.toBeInTheDocument();
    expect(row.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  test('inactive members show Desativado and no controls', async () => {
    renderTeam();
    await screen.findByText('inativo@exemplo.com');

    const row = memberRow('inativo@exemplo.com');

    expect(row.getByText('Desativado')).toBeInTheDocument();
    expect(row.queryByRole('button')).not.toBeInTheDocument();
  });

  test('deactivating asks for confirmation first', async () => {
    const { repository } = renderTeam();
    const user = userEvent.setup();
    await screen.findByText('Bruno Alves');

    await user.click(memberRow('Bruno Alves').getByRole('button', { name: 'Desativar' }));
    expect(repository.deactivateMember).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Desativar membro' }));

    await waitFor(() => expect(repository.deactivateMember).toHaveBeenCalledWith('u2'));
  });

  test('shows the server message when deactivating fails', async () => {
    const repository = fakeTeamRepository({
      deactivateMember: jest.fn().mockRejectedValue(new TeamError('Você não pode se desativar')),
    });
    renderTeam(repository);
    const user = userEvent.setup();
    await screen.findByText('Bruno Alves');

    await user.click(memberRow('Bruno Alves').getByRole('button', { name: 'Desativar' }));
    await user.click(screen.getByRole('button', { name: 'Desativar membro' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Você não pode se desativar');
  });

  test('invite requires an e-mail', async () => {
    const { repository } = renderTeam();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Gerar convite' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Informe o e-mail da pessoa');
    expect(repository.invite).not.toHaveBeenCalled();
  });

  test('invites as Membro by default and shows the share card', async () => {
    const { repository } = renderTeam();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('E-mail da pessoa'), 'Nova@Exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Gerar convite' }));

    expect(repository.invite).toHaveBeenCalledWith('nova@exemplo.com', 'member', undefined);
    expect(await screen.findByTestId('invite-link')).toHaveTextContent(CREATED_INVITATION.link);
  });

  test('invites as Dono when selected', async () => {
    const { repository } = renderTeam();
    const user = userEvent.setup();

    await user.selectOptions(await screen.findByLabelText('Papel'), 'owner');
    await user.type(screen.getByLabelText('E-mail da pessoa'), 'dono@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Gerar convite' }));

    expect(repository.invite).toHaveBeenCalledWith('dono@exemplo.com', 'owner', undefined);
  });

  test('revokes a pending invitation', async () => {
    const { repository } = renderTeam();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Revogar' }));

    await waitFor(() => expect(repository.revokeInvitation).toHaveBeenCalledWith('i1'));
  });

  test('saves the organization name', async () => {
    const { repository } = renderTeam();
    const user = userEvent.setup();
    const field = await screen.findByLabelText('Nome da organização');

    await user.clear(field);
    await user.type(field, 'Nova Aurora');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(repository.rename).toHaveBeenCalledWith('Nova Aurora'));
  });

  test('shows an error state with retry when loading fails', async () => {
    const get = jest.fn().mockRejectedValueOnce(new TeamError('x')).mockResolvedValue(undefined);
    renderTeam(fakeTeamRepository({ get }));

    expect(await screen.findByText('Não foi possível carregar a equipe.')).toBeInTheDocument();
  });

  test('goes back', async () => {
    const { onBack } = renderTeam();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Voltar' }));

    expect(onBack).toHaveBeenCalled();
  });
});
