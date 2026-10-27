import { hashToken } from '../../platform/tokens';
import {
  CONDO_A,
  INVITE_NOW,
  fakeCondos,
  fakeResidentsFor,
  ORG_A,
  inMemoryInvitationTokens,
  invitationFixture,
  membroInvitationFixture,
  residentFixture,
  sindicoInvitationFixture,
} from '../../test-support/in-memory-invitations';
import { inMemoryUsers } from '../../test-support/in-memory-users';
import type { User } from '../../users/domain/user';
import type { Invitation, MoradorInvitation } from '../domain/invitation';

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

function storedDeps(stored: Invitation, users: User[] = [], condoActive = true) {
  return {
    invitations: inMemoryInvitationTokens([{ invitation: stored, tokenHash: hashToken(TOKEN) }]),
    condos: fakeCondos([{ ...CONDO_A, active: condoActive }], [ORG_A]),
    residentsFor: fakeResidentsFor({ 'condo-a': [residentFixture()] }),
    users: inMemoryUsers(users),
    now: () => INVITE_NOW,
  };
}

function deps(invitation: Partial<MoradorInvitation> = {}, users: User[] = [], condoActive = true) {
  return storedDeps(invitationFixture(invitation), users, condoActive);
}

describe('previewInvitation', () => {
  test('returns only the condo, resident name, apartment and e-mail', async () => {
    expect(await previewInvitation(deps(), TOKEN)).toEqual({
      role: 'morador',
      targetName: 'Morada Bloco 2',
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

  test('a sindico invite names the role and the condominium', async () => {
    expect(await previewInvitation(storedDeps(sindicoInvitationFixture(), [maria]), TOKEN)).toEqual(
      {
        role: 'sindico',
        targetName: 'Morada Bloco 2',
        condoName: 'Morada Bloco 2',
        email: 'maria@x.com',
        accountExists: true,
      },
    );
  });

  test('a membro invite names the role and the organization', async () => {
    expect(await previewInvitation(storedDeps(membroInvitationFixture()), TOKEN)).toEqual({
      role: 'membro',
      targetName: 'Contábil Aurora',
      email: 'maria@x.com',
      accountExists: false,
    });
  });
});
