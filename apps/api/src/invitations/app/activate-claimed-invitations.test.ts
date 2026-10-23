import {
  CONDO_A,
  INVITE_NOW,
  fakeCondos,
  fakeResidentsFor,
  inMemoryInvitationTokens,
  invitationFixture,
  residentFixture,
} from '../../test-support/in-memory-invitations';
import { inMemoryUsers } from '../../test-support/in-memory-users';
import type { User } from '../../users/domain/user';

import { activateClaimedInvitations } from './activate-claimed-invitations';

const maria: User = {
  id: 'u-maria',
  username: null,
  email: 'maria@x.com',
  name: 'Maria',
  passwordHash: 'x',
  role: 'resident',
  residentId: null,
  emailVerifiedAt: INVITE_NOW,
  sessionVersion: 1,
};

const AFTER_EXPIRY = new Date(INVITE_NOW.getTime() + 24 * 60 * 60 * 1000);

function setup(user: User = maria, condoActive = true) {
  const invitations = inMemoryInvitationTokens([
    { invitation: invitationFixture({ claimedBy: 'u-maria' }), tokenHash: 'h1' },
    {
      invitation: invitationFixture({ id: 'inv-2', residentId: 'r-2', claimedBy: 'u-maria' }),
      tokenHash: 'h2',
    },
    { invitation: invitationFixture({ id: 'inv-3', claimedBy: 'u-other' }), tokenHash: 'h3' },
  ]);
  const condos = fakeCondos([{ ...CONDO_A, active: condoActive }]);
  const deps = {
    invitations,
    condos,
    users: inMemoryUsers([user]),
    residentsFor: fakeResidentsFor({
      'condo-a': [residentFixture(), residentFixture({ id: 'r-2', active: false })],
    }),
    now: () => AFTER_EXPIRY,
  };
  return { deps, invitations, condos };
}

describe('activateClaimedInvitations', () => {
  test('grants and accepts every claimed invitation even after expiry, retiring the legacy login', async () => {
    const { deps, invitations, condos } = setup();

    await activateClaimedInvitations(deps, 'u-maria');

    expect(condos.grants()).toEqual([
      { condominiumId: 'condo-a', userId: 'u-maria', role: 'morador', residentId: 'r-1' },
    ]);
    expect(condos.deactivations()).toEqual([
      { condominiumId: 'condo-a', residentId: 'r-1', exceptUserId: 'u-maria' },
    ]);
    expect(invitations.byId('inv-1')?.status).toBe('aceito');
    expect(invitations.byId('inv-2')?.status).toBe('pendente');
    expect(invitations.byId('inv-3')?.status).toBe('pendente');
  });

  test('an invitation revoked mid-activation grants nothing', async () => {
    const { deps, condos } = setup();
    const racing = { ...deps, invitations: { ...deps.invitations, accept: async () => false } };

    await activateClaimedInvitations(racing, 'u-maria');

    expect(condos.grants()).toEqual([]);
    expect(condos.deactivations()).toEqual([]);
  });

  test('skips invitations of an inactive condominium', async () => {
    const { deps, invitations, condos } = setup(maria, false);

    await activateClaimedInvitations(deps, 'u-maria');

    expect(condos.grants()).toEqual([]);
    expect(invitations.byId('inv-1')?.status).toBe('pendente');
  });

  test('is idempotent', async () => {
    const { deps, condos } = setup();

    await activateClaimedInvitations(deps, 'u-maria');
    await activateClaimedInvitations(deps, 'u-maria');

    expect(condos.grants()).toHaveLength(1);
  });

  test('does nothing for an unverified or unknown user', async () => {
    const unverified = setup({ ...maria, emailVerifiedAt: null });

    await activateClaimedInvitations(unverified.deps, 'u-maria');
    await activateClaimedInvitations(unverified.deps, 'u-ghost');

    expect(unverified.condos.grants()).toEqual([]);
    expect(unverified.invitations.byId('inv-1')?.status).toBe('pendente');
  });
});
