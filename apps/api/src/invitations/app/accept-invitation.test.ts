import { InMemoryEmailSender } from '../../platform/email/in-memory-email-sender';
import { hashToken } from '../../platform/tokens';
import {
  CONDO_A,
  INVITE_NOW,
  ORG_A,
  fakeCondos,
  fakeResidentsFor,
  inMemoryInvitationTokens,
  invitationFixture,
  membroInvitationFixture,
  residentFixture,
  sindicoInvitationFixture,
} from '../../test-support/in-memory-invitations';
import { inMemoryAuthTokens, inMemoryUsers } from '../../test-support/in-memory-users';
import type { PasswordHasher } from '../../users/domain/password-hasher';
import type { User } from '../../users/domain/user';
import type { Invitation, MoradorInvitation } from '../domain/invitation';

import { acceptInvitation } from './accept-invitation';

const hasher: PasswordHasher = {
  hash: (plain) => Promise.resolve(`hash:${plain}`),
  verify: (plain, hash) => Promise.resolve(hash === `hash:${plain}`),
};

const TOKEN = 'convite-token';

function account(overrides: Partial<User> = {}): User {
  return {
    id: 'u-maria',
    username: null,
    email: 'maria@x.com',
    name: 'Maria',
    passwordHash: 'hash:senha-antiga',
    role: 'resident',
    residentId: null,
    emailVerifiedAt: INVITE_NOW,
    sessionVersion: 3,
    ...overrides,
  };
}

interface SetupOptions {
  invitation?: Partial<MoradorInvitation>;
  stored?: Invitation;
  users?: User[];
  active?: boolean;
}

function setup(opts: SetupOptions = {}) {
  const invitations = inMemoryInvitationTokens([
    {
      invitation: opts.stored ?? invitationFixture(opts.invitation),
      tokenHash: hashToken(TOKEN),
    },
  ]);
  const condos = fakeCondos([CONDO_A], [ORG_A]);
  const users = inMemoryUsers(opts.users ?? []);
  const email = new InMemoryEmailSender();
  const activated: string[] = [];
  const deps = {
    invitations,
    condos,
    residentsFor: fakeResidentsFor({
      'condo-a': [residentFixture({ active: opts.active ?? true })],
    }),
    users,
    hasher,
    tokens: inMemoryAuthTokens(),
    email,
    appUrl: 'https://app.test',
    now: () => INVITE_NOW,
    activateClaimed: async (userId: string) => {
      activated.push(userId);
    },
  };
  return { deps, invitations, condos, users, email, activated };
}

const granted = { condominiumId: 'condo-a', role: 'morador', residentId: 'r-1' };

describe('acceptInvitation', () => {
  test('an e-mail invite with a new account creates a verified resident and grants now', async () => {
    const { deps, invitations, condos, email } = setup();

    const user = await acceptInvitation(deps, TOKEN, { password: 'senha-segura', name: 'Maria' });

    expect(user).toMatchObject({
      email: 'maria@x.com',
      name: 'Maria',
      role: 'resident',
      username: null,
      residentId: null,
      emailVerifiedAt: INVITE_NOW,
      sessionVersion: 0,
    });
    expect(condos.grants()).toEqual([{ ...granted, userId: user.id }]);
    expect(condos.deactivations()).toEqual([
      { condominiumId: 'condo-a', residentId: 'r-1', exceptUserId: user.id },
    ]);
    expect(invitations.byId('inv-1')).toMatchObject({ status: 'aceito', claimedBy: user.id });
    expect(email.sent).toEqual([]);
  });

  test('a WhatsApp invite with a new account claims and sends the confirmation', async () => {
    const { deps, invitations, condos, email } = setup({ invitation: { email: null } });

    const user = await acceptInvitation(deps, TOKEN, {
      email: ' Nova@X.com ',
      password: 'senha-segura',
      name: 'Maria',
    });

    expect(user).toMatchObject({ email: 'nova@x.com', emailVerifiedAt: null });
    expect(condos.grants()).toEqual([]);
    expect(invitations.byId('inv-1')).toMatchObject({ status: 'pendente', claimedBy: user.id });
    expect(email.lastTo('nova@x.com')?.subject).toBe('Confirme seu e-mail no Morada');
  });

  test('a WhatsApp invite requires a valid e-mail in the body', async () => {
    const { deps } = setup({ invitation: { email: null } });

    await expect(
      acceptInvitation(deps, TOKEN, { password: 'senha-segura', name: 'Maria' }),
    ).rejects.toMatchObject({ name: 'ZodError' });
  });

  test.each([
    [{ password: 'curta', name: 'Maria' }],
    [{ password: 'senha-segura' }],
    [{ password: 'senha-segura', name: '   ' }],
  ])('a new account needs a strong password and a name: %j', async (body) => {
    const { deps, users } = setup();

    await expect(acceptInvitation(deps, TOKEN, body)).rejects.toMatchObject({ name: 'ZodError' });
    expect(users.all()).toEqual([]);
  });

  test('an existing verified account must authenticate, else 401 and the invite is untouched', async () => {
    const { deps, invitations, condos } = setup({ users: [account()] });

    await expect(acceptInvitation(deps, TOKEN, { password: 'errada' })).rejects.toMatchObject({
      status: 401,
      message: 'Usuário ou senha inválidos',
    });
    expect(invitations.byId('inv-1')).toMatchObject({ status: 'pendente', claimedBy: null });
    expect(condos.grants()).toEqual([]);
  });

  test('an existing verified account with the right password is granted now', async () => {
    const { deps, invitations, condos } = setup({
      users: [account()],
      invitation: { email: null },
    });

    const user = await acceptInvitation(deps, TOKEN, {
      email: 'maria@x.com',
      password: 'senha-antiga',
      name: 'Maria',
    });

    expect(user).toEqual(account());
    expect(condos.grants()).toEqual([{ ...granted, userId: 'u-maria' }]);
    expect(invitations.byId('inv-1')?.status).toBe('aceito');
  });

  test('an existing unverified account on an e-mail invite is verified and its session bumped', async () => {
    const { deps, condos, users, activated } = setup({
      users: [account({ emailVerifiedAt: null })],
    });

    const user = await acceptInvitation(deps, TOKEN, { password: 'senha-antiga' });

    expect(user).toMatchObject({ emailVerifiedAt: INVITE_NOW, sessionVersion: 4 });
    expect((await users.findById('u-maria'))?.sessionVersion).toBe(4);
    expect(condos.grants()).toEqual([{ ...granted, userId: 'u-maria' }]);
    expect(activated).toEqual(['u-maria']);
  });

  test('an existing unverified account on a WhatsApp invite claims and gets a fresh confirmation', async () => {
    const { deps, invitations, condos, email } = setup({
      users: [account({ emailVerifiedAt: null })],
      invitation: { email: null },
    });

    const user = await acceptInvitation(deps, TOKEN, {
      email: 'maria@x.com',
      password: 'senha-antiga',
      name: 'Maria',
    });

    expect(user.emailVerifiedAt).toBeNull();
    expect(condos.grants()).toEqual([]);
    expect(invitations.byId('inv-1')?.claimedBy).toBe('u-maria');
    expect(email.lastTo('maria@x.com')?.subject).toBe('Confirme seu e-mail no Morada');
  });

  test('the claimer may accept again after being verified', async () => {
    const { deps, invitations } = setup({
      users: [account()],
      invitation: { email: null, claimedBy: 'u-maria' },
    });

    await acceptInvitation(deps, TOKEN, {
      email: 'maria@x.com',
      password: 'senha-antiga',
      name: 'Maria',
    });

    expect(invitations.byId('inv-1')?.status).toBe('aceito');
  });

  test('an invite claimed by someone else is invalid for an existing or a new account', async () => {
    const existing = setup({ users: [account()], invitation: { claimedBy: 'u-other' } });
    const fresh = setup({ invitation: { claimedBy: 'u-other' } });

    await expect(
      acceptInvitation(existing.deps, TOKEN, { password: 'senha-antiga' }),
    ).rejects.toMatchObject({ status: 404, message: 'Convite inválido ou expirado' });
    await expect(
      acceptInvitation(fresh.deps, TOKEN, { password: 'senha-segura', name: 'Maria' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(fresh.users.all()).toEqual([]);
  });

  test.each([
    ['expired', { expiresAt: INVITE_NOW }],
    ['revoked', { status: 'revogado' as const }],
    ['accepted', { status: 'aceito' as const }],
  ])('an %s invite is invalid', async (_label, invitation) => {
    const { deps, users } = setup({ invitation });

    await expect(
      acceptInvitation(deps, TOKEN, { password: 'senha-segura', name: 'Maria' }),
    ).rejects.toMatchObject({ status: 404, message: 'Convite inválido ou expirado' });
    expect(users.all()).toEqual([]);
  });

  test('an unknown token or an inactive resident is invalid', async () => {
    const { deps } = setup();
    const inactive = setup({ active: false });

    await expect(
      acceptInvitation(deps, 'outro', { password: 'senha-segura', name: 'Maria' }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      acceptInvitation(inactive.deps, TOKEN, { password: 'senha-segura', name: 'Maria' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  test('a WhatsApp invite answers the same 400 for a body unfit for a new account, account or not', async () => {
    const existing = setup({ users: [account()], invitation: { email: null } });
    const fresh = setup({ invitation: { email: null } });
    const body = { email: 'maria@x.com', password: 'senha-antiga' };

    const answers = await Promise.all(
      [existing, fresh].map(({ deps }) =>
        acceptInvitation(deps, TOKEN, body).catch((error: unknown) => error),
      ),
    );

    expect(answers.map((e) => (e as { name?: string }).name)).toEqual(['ZodError', 'ZodError']);
    expect(existing.invitations.byId('inv-1')?.claimedBy).toBeNull();
    expect(fresh.users.all()).toEqual([]);
  });

  test('an invite revoked between claim and accept grants nothing', async () => {
    const { deps, condos } = setup({ users: [account()] });
    const racing = { ...deps, invitations: { ...deps.invitations, accept: async () => false } };

    await expect(
      acceptInvitation(racing, TOKEN, { password: 'senha-antiga' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(condos.grants()).toEqual([]);
    expect(condos.deactivations()).toEqual([]);
  });

  test('sindico invite grants sindico and retires the previous sindico', async () => {
    const { deps, invitations, condos } = setup({ stored: sindicoInvitationFixture() });

    const user = await acceptInvitation(deps, TOKEN, { password: 'senha-segura', name: 'Maria' });

    expect(user).toMatchObject({ email: 'maria@x.com', emailVerifiedAt: INVITE_NOW });
    expect(condos.grants()).toEqual([
      { condominiumId: 'condo-a', userId: user.id, role: 'sindico', residentId: null },
    ]);
    expect(condos.sindicoRetirements()).toEqual([
      { condominiumId: 'condo-a', keepUserId: user.id },
    ]);
    expect(condos.deactivations()).toEqual([]);
    expect(invitations.byId('inv-sindico')).toMatchObject({ status: 'aceito', claimedBy: user.id });
  });

  test('sindico invite of an existing account needs its password and grants on that account', async () => {
    const { deps, condos } = setup({ stored: sindicoInvitationFixture(), users: [account()] });

    await expect(acceptInvitation(deps, TOKEN, { password: 'errada' })).rejects.toMatchObject({
      status: 401,
    });
    expect(condos.grants()).toEqual([]);

    await acceptInvitation(deps, TOKEN, { password: 'senha-antiga' });

    expect(condos.grants()).toEqual([
      { condominiumId: 'condo-a', userId: 'u-maria', role: 'sindico', residentId: null },
    ]);
  });

  test.each([
    ['sindico', sindicoInvitationFixture()],
    ['membro', membroInvitationFixture()],
    ['morador', invitationFixture()],
  ])('staff invite requires the invited e-mail (%s)', async (_label, stored) => {
    const other = account({ id: 'u-other', email: 'outra@x.com' });
    const { deps, invitations, condos, users } = setup({ stored, users: [other] });

    const answers = await Promise.all(
      [
        { email: 'outra@x.com', password: 'senha-antiga' },
        { email: 'nova@x.com', password: 'senha-segura', name: 'Nova' },
      ].map((body) => acceptInvitation(deps, TOKEN, body).catch((error: unknown) => error)),
    );

    expect(answers).toEqual([
      expect.objectContaining({ status: 401, message: 'Usuário ou senha inválidos' }),
      expect.objectContaining({ status: 401, message: 'Usuário ou senha inválidos' }),
    ]);
    expect(invitations.byId(stored.id)).toMatchObject({ status: 'pendente', claimedBy: null });
    expect(condos.grants()).toEqual([]);
    expect(condos.orgMembers()).toEqual([]);
    expect(users.all()).toEqual([other]);
  });

  test('an invited e-mail repeated in the body is accepted after normalization', async () => {
    const { deps, condos } = setup({ stored: sindicoInvitationFixture() });

    const user = await acceptInvitation(deps, TOKEN, {
      email: ' Maria@X.com ',
      password: 'senha-segura',
      name: 'Maria',
    });

    expect(condos.grants()).toEqual([
      { condominiumId: 'condo-a', userId: user.id, role: 'sindico', residentId: null },
    ]);
  });

  test('membro invite adds an org membership with the invited org role', async () => {
    const { deps, invitations, condos } = setup({
      stored: membroInvitationFixture({ orgRole: 'owner' }),
    });

    const user = await acceptInvitation(deps, TOKEN, { password: 'senha-segura', name: 'Maria' });

    expect(condos.orgMembers()).toEqual([
      { organizationId: 'org-a', userId: user.id, role: 'owner' },
    ]);
    expect(condos.grants()).toEqual([]);
    expect(invitations.byId('inv-membro')?.status).toBe('aceito');
  });

  test('a membro invite of an unknown or inactive organization is invalid', async () => {
    const { deps, users } = setup({
      stored: membroInvitationFixture({ organizationId: 'org-ghost' }),
    });

    await expect(
      acceptInvitation(deps, TOKEN, { password: 'senha-segura', name: 'Maria' }),
    ).rejects.toMatchObject({ status: 404, message: 'Convite inválido ou expirado' });
    expect(users.all()).toEqual([]);
  });

  test('a sindico invite of an inactive condominium is invalid', async () => {
    const { deps, condos } = setup({
      stored: sindicoInvitationFixture({ condominiumId: 'condo-ghost' }),
    });

    await expect(
      acceptInvitation(deps, TOKEN, { password: 'senha-segura', name: 'Maria' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(condos.grants()).toEqual([]);
  });

  test('accept is single use', async () => {
    const { deps } = setup();
    await acceptInvitation(deps, TOKEN, { password: 'senha-segura', name: 'Maria' });

    await expect(
      acceptInvitation(deps, TOKEN, { password: 'senha-segura', name: 'Maria' }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
