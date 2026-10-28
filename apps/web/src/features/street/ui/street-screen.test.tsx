import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { loginCondoSchema } from '@/features/session/domain/login-response';
import { renderWithClient } from '@/test/render';

import type { Pendencies, Street, StreetCondo } from '../domain/street';
import type { StreetRepository } from '../domain/street-repository';

import { StreetScreen } from './street-screen';

const none: Pendencies = {
  overdueResidents: 0,
  overdueAccounts: 0,
  accountsDueSoon: 0,
  proofsToReview: 0,
  unreadThreads: 0,
};

function condo(name: string, pendencies: Partial<Pendencies> = {}): StreetCondo {
  return {
    id: name.toLowerCase(),
    name,
    role: 'admin',
    condoRole: 'administrador',
    permissions: [],
    hasHome: false,
    organizationId: 'o1',
    orgRole: null,
    onboardingPending: false,
    pendencies: { ...none, ...pendencies },
    windows: [{ block: null, floor: 1, position: 1, lit: true }],
  };
}

function repositoryOf(street: Partial<Street>): StreetRepository {
  return {
    get: jest.fn().mockResolvedValue({ name: 'Lucas Dantas', condos: [], homes: [], ...street }),
  };
}

const noop = () => undefined;
const now = () => new Date(2026, 9, 28, 9, 0);

function renderScreen(repository: StreetRepository, handlers: Partial<{ onOpen: jest.Mock }> = {}) {
  return renderWithClient(
    <StreetScreen
      repository={repository}
      now={now}
      onOpen={handlers.onOpen ?? jest.fn()}
      onNewCondo={noop}
      onSignOut={noop}
    />,
  );
}

describe('StreetScreen', () => {
  test('orders buildings urgent first and puts + Novo condomínio last', async () => {
    renderScreen(
      repositoryOf({
        condos: [
          condo('Calmo'),
          condo('Aviso', { unreadThreads: 1 }),
          condo('Fogo', { overdueAccounts: 2 }),
        ],
      }),
    );

    const street = await screen.findByRole('list', { name: 'Rua de condomínios' });
    const buttons = within(street).getAllByRole('button');

    expect(buttons.map((b) => b.textContent)).toEqual([
      expect.stringContaining('Fogo'),
      expect.stringContaining('Aviso'),
      expect.stringContaining('Calmo'),
      '+ Novo condomínio',
    ]);
    expect(screen.getByText('Bom dia, Lucas')).toBeVisible();
    expect(screen.getByText('3 condomínios · 2 pedem atenção hoje')).toBeVisible();
  });

  test('the building button describes the condo and its reasons', async () => {
    renderScreen(repositoryOf({ condos: [condo('Fogo', { overdueAccounts: 2 })] }));

    expect(
      await screen.findByRole('button', { name: 'Fogo, 1 apartamentos, 2 contas vencidas' }),
    ).toBeVisible();
  });

  test('tapping a building opens the condo home', async () => {
    const onOpen = jest.fn();
    const fogo = condo('Fogo', { overdueAccounts: 2 });
    renderScreen(repositoryOf({ condos: [fogo] }), { onOpen });

    await userEvent.click(await screen.findByRole('button', { name: /^Fogo,/ }));

    expect(onOpen).toHaveBeenCalledWith(fogo, 'a-home');
  });

  test('tapping an attention item opens that condo at the problem screen', async () => {
    const onOpen = jest.fn();
    const fogo = condo('Fogo', { overdueResidents: 1, overdueAccounts: 2, unreadThreads: 3 });
    renderScreen(repositoryOf({ condos: [fogo] }), { onOpen });

    const section = await screen.findByRole('region', { name: 'Pede atenção hoje' });
    await userEvent.click(within(section).getByRole('button', { name: /2 contas vencidas/ }));
    await userEvent.click(
      within(section).getByRole('button', { name: /1 morador com taxa vencida/ }),
    );
    await userEvent.click(within(section).getByRole('button', { name: /3 mensagens não lidas/ }));

    expect(onOpen.mock.calls).toEqual([
      [fogo, 'a-accounts'],
      [fogo, 'a-residents'],
      [fogo, 'a-messages'],
    ]);
    expect(within(section).getAllByText('urgente')).toHaveLength(2);
    expect(within(section).getAllByText('atenção')).toHaveLength(1);
  });

  test('the select lists condos by urgency with the reason', async () => {
    const onOpen = jest.fn();
    const fogo = condo('Fogo', { overdueAccounts: 2 });
    renderScreen(repositoryOf({ condos: [condo('Calmo'), fogo] }), { onOpen });

    const select = await screen.findByLabelText('Ir para um condomínio…');
    const options = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent);

    expect(options).toEqual(['Ir para um condomínio…', 'Fogo — 2 contas vencidas', 'Calmo']);

    await userEvent.selectOptions(select, 'Fogo — 2 contas vencidas');

    expect(onOpen).toHaveBeenCalledWith(fogo, 'a-home');
  });

  test('homes are listed without pendencies', async () => {
    const onOpen = jest.fn();
    const login = loginCondoSchema.parse(condo('Minha Casa', { overdueAccounts: 5 }));
    renderScreen(repositoryOf({ condos: [condo('Fogo')], homes: [login] }), { onOpen });

    const section = await screen.findByRole('region', { name: 'Onde você mora' });
    await userEvent.click(within(section).getByRole('button', { name: 'Minha Casa' }));

    expect(within(section).queryByText(/vencid/)).not.toBeInTheDocument();
    expect(onOpen).toHaveBeenCalledWith(login, 'r-home');
  });

  test('hides Onde você mora when there are no homes', async () => {
    renderScreen(repositoryOf({ condos: [condo('Fogo')] }));

    await screen.findByRole('list', { name: 'Rua de condomínios' });

    expect(screen.queryByRole('region', { name: 'Onde você mora' })).not.toBeInTheDocument();
  });

  test('empty attention list says Nada pede atenção hoje.', async () => {
    renderScreen(repositoryOf({ condos: [condo('Calmo')] }));

    expect(await screen.findByText('Nada pede atenção hoje.')).toBeVisible();
  });

  test('error state retries', async () => {
    const get = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ name: null, condos: [condo('Calmo')], homes: [] });
    renderScreen({ get });

    await userEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('button', { name: /^Calmo,/ })).toBeVisible();
    expect(get).toHaveBeenCalledTimes(2);
  });

  test('new condo and sign out call their handlers', async () => {
    const onNewCondo = jest.fn();
    const onSignOut = jest.fn();
    renderWithClient(
      <StreetScreen
        repository={repositoryOf({ condos: [condo('Calmo')] })}
        now={now}
        onOpen={jest.fn()}
        onNewCondo={onNewCondo}
        onSignOut={onSignOut}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: '+ Novo condomínio' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

    expect(onNewCondo).toHaveBeenCalledTimes(1);
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
