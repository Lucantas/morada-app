import { hashToken } from '../../platform/tokens';
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
import type { Invitation } from '../domain/invitation';

import { previewInvitation } from './preview-invitation';

const TOKEN = 'convite-token';

const maria: User = {
  id: 'u-maria',
  username: null,
  email: 'maria@x.com',
  name: 'Maria',
  passwordHash: 'x',
  role: 'resident',
  residentId: null,
  emailVerifiedAt: null,
  sessionVersion: 0,
};

function deps(invitation: Partial<Invitation> = {}, users: User[] = [], condoActive = true) {
  return {
    invitations: inMemoryInvitationTokens([
      { invitation: invitationFixture(invitation), tokenHash: hashToken(TOKEN) },
    ]),
    condos: fakeCondos([{ ...CONDO_A, active: condoActive }]),
    residentsFor: fakeResidentsFor({ 'condo-a': [residentFixture()] }),
    users: inMemoryUsers(users),
    now: () => INVITE_NOW,
  };
}

describe('previewInvitation', () => {
  test('returns only the condo, resident name, apartment and e-mail', async () => {
    expect(await previewInvitation(deps(), TOKEN)).toEqual({
      condoName: 'Morada Bloco 2',
      residentName: 'Maria Ribeiro',
      apt: 'Apto 302',
      email: 'maria@x.com',
      accountExists: false,
    });
  });

  test('reports an existing account only when the invite has an e-mail', async () => {
    expect((await previewInvitation(deps({}, [maria]), TOKEN)).accountExists).toBe(true);
    expect(await previewInvitation(deps({ email: null }, [maria]), TOKEN)).toMatchObject({
      email: null,
      accountExists: false,
    });
  });

  test('an expired invite or an inactive condominium is invalid', async () => {
    await expect(previewInvitation(deps({ expiresAt: INVITE_NOW }), TOKEN)).rejects.toMatchObject({
      status: 404,
      message: 'Convite inválido ou expirado',
    });
    await expect(previewInvitation(deps({}, [], false), TOKEN)).rejects.toMatchObject({
      status: 404,
    });
  });
});
