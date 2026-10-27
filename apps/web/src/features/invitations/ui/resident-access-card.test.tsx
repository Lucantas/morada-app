import { screen } from '@testing-library/react';

import { PENDING_INVITATION, fakeInvitationRepository } from '@/test/factories.invitations';
import { renderWithClient } from '@/test/render';

import { ResidentAccessCard } from './resident-access-card';

describe('ResidentAccessCard', () => {
  test('offers to generate an invite for a resident without one', async () => {
    renderWithClient(
      <ResidentAccessCard
        residentId="r-1"
        residentEmail="ana@exemplo.com"
        repository={fakeInvitationRepository()}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Gerar convite' })).toBeInTheDocument();
  });

  test('shows a pending invite', async () => {
    renderWithClient(
      <ResidentAccessCard
        residentId="r-1"
        residentEmail="ana@exemplo.com"
        repository={fakeInvitationRepository({
          invitation: jest.fn().mockResolvedValue(PENDING_INVITATION),
        })}
      />,
    );

    expect(await screen.findByText(/Convite pendente/)).toBeInTheDocument();
  });

  test('shows an error when the invite cannot load', async () => {
    renderWithClient(
      <ResidentAccessCard
        residentId="r-1"
        residentEmail=""
        repository={fakeInvitationRepository({
          invitation: jest.fn().mockRejectedValue(new Error('falhou')),
        })}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o acesso.',
    );
  });
});
