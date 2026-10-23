import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fakeUserAccountRepository } from '@/test/factories.account';
import { renderWithClient } from '@/test/render';

import { AccountError } from '../domain/errors';

import { CreateCondoScreen } from './create-condo-screen';

function renderCreate(repository = fakeUserAccountRepository()) {
  const props = { repository, onCreated: jest.fn(), onSignOut: jest.fn() };
  renderWithClient(<CreateCondoScreen {...props} />);
  return props;
}

async function submit(name: string) {
  const user = userEvent.setup();
  if (name) await user.type(screen.getByLabelText('Nome do condomínio'), name);
  await user.click(screen.getByRole('button', { name: 'Criar condomínio' }));
  return user;
}

describe('CreateCondoScreen', () => {
  test('asks which condominium to manage', () => {
    renderCreate();

    expect(
      screen.getByRole('heading', { name: 'Que condomínio vamos gerenciar hoje?' }),
    ).toBeInTheDocument();
  });

  test('rejects a blank name', async () => {
    const { repository } = renderCreate();

    await submit('   ');

    expect(screen.getByRole('alert')).toHaveTextContent('Informe o nome do condomínio.');
    expect(repository.createCondo).not.toHaveBeenCalled();
  });

  test('creates the condominium and hands back the admin condo', async () => {
    const { repository, onCreated } = renderCreate();

    await submit('  Edifício Sol ');

    expect(repository.createCondo).toHaveBeenCalledWith('Edifício Sol');
    expect(onCreated).toHaveBeenCalledWith({ id: 'c9', name: 'Edifício Sol', role: 'admin' });
  });

  test('explains an unconfirmed e-mail', async () => {
    renderCreate(
      fakeUserAccountRepository({
        createCondo: jest.fn().mockRejectedValue(new AccountError('email-not-confirmed')),
      }),
    );

    await submit('Edifício Sol');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Confirme seu e-mail antes de criar um condomínio.',
    );
  });

  test('signs out', async () => {
    const { onSignOut } = renderCreate();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(onSignOut).toHaveBeenCalled();
  });
});
