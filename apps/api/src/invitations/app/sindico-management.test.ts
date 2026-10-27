import { sindicoInvitationFixture } from '../../test-support/in-memory-invitations';
import type { SindicoInvitation } from '../domain/invitation';

import { getSindico } from './get-sindico';
import { removeSindico } from './remove-sindico';
import { revokeSindicoInvitation } from './revoke-sindico-invitation';

function fakes(
  invitation: SindicoInvitation | null,
  current: { userId: string; name: string | null; email: string | null } | null,
) {
  const calls: string[] = [];
  return {
    calls,
    invitations: {
      latestSindico: async () => invitation,
      revokeSindico: async () => {
        calls.push('revokeSindico');
      },
    },
    condos: {
      currentSindico: async (condoId: string) => {
        calls.push(`currentSindico:${condoId}`);
        return current;
      },
      removeSindico: async (condoId: string) => {
        calls.push(`removeSindico:${condoId}`);
      },
    },
  };
}

describe('síndico management', () => {
  test('getSindico shows the current sindico and the latest invitation without the token', async () => {
    const invitation = sindicoInvitationFixture({ email: 's@x.com' });
    const deps = fakes(invitation, { userId: 'u-s', name: 'Síndica', email: 's@x.com' });

    expect(await getSindico(deps, 'condo-a', new Date())).toEqual({
      current: { name: 'Síndica', email: 's@x.com' },
      invitation: { status: 'pendente', email: 's@x.com', expiresAt: invitation.expiresAt },
    });
    expect(deps.calls).toEqual(['currentSindico:condo-a']);
  });

  test('getSindico is empty without a sindico or an invitation', async () => {
    expect(await getSindico(fakes(null, null), 'condo-a', new Date())).toEqual({
      current: null,
      invitation: null,
    });
  });

  test('revokeSindicoInvitation and removeSindico act on that condominium', async () => {
    const deps = fakes(null, null);

    await revokeSindicoInvitation(deps);
    await removeSindico(deps, 'condo-a');

    expect(deps.calls).toEqual(['revokeSindico', 'removeSindico:condo-a']);
  });
});
