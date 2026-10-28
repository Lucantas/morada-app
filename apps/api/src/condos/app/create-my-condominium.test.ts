import { CondoValidationError, EmailNotConfirmedError } from '../domain/errors';
import type { CondoRepository, CreateCondominiumInput } from '../domain/condo-repository';
import type { User } from '../../users/domain/user';
import { createMyCondominium } from './create-my-condominium';

const verifiedUser: User = {
  id: 'u-1',
  username: null,
  email: 'ana@x.com',
  name: 'Ana',
  passwordHash: 'h',
  role: 'resident',
  residentId: null,
  emailVerifiedAt: new Date('2026-01-01'),
  sessionVersion: 0,
};

function fakeCondos(owned: { id: string } | null = null, member: { id: string } | null = null) {
  const calls: string[] = [];
  const created: CreateCondominiumInput[] = [];
  const repo: Pick<
    CondoRepository,
    'ownedOrganization' | 'memberOrganization' | 'createOrganization' | 'create' | 'grant'
  > = {
    ownedOrganization: async () => owned,
    memberOrganization: async () => member,
    createOrganization: async (input) => {
      calls.push(`org:${input.name}:${input.ownerUserId}`);
      return { id: 'org-new' };
    },
    create: async (input) => {
      calls.push(`create:${input.organizationId}:${input.monthlyFeeCents}:${input.dueDay}`);
      created.push(input);
      return { id: 'c-1', organizationId: input.organizationId, name: input.name, active: true };
    },
    grant: async (grant) => {
      calls.push(`grant:${grant.condominiumId}:${grant.userId}:${grant.role}`);
    },
  };
  return { repo, calls, created };
}

describe('createMyCondominium', () => {
  test('creates the organization, the condominium and the administrador grant', async () => {
    const { repo, calls } = fakeCondos();

    const summary = await createMyCondominium(repo, verifiedUser, { name: '  Residencial Ipê ' });

    expect(summary).toEqual({
      id: 'c-1',
      name: 'Residencial Ipê',
      role: 'admin',
      condoRole: 'administrador',
      permissions: [
        'view_building',
        'publish_notices',
        'manage_residents',
        'manage_money',
        'manage_fees',
        'manage_condo',
        'view_activity',
      ],
      hasHome: false,
      organizationId: 'org-new',
      orgRole: 'owner',
      onboardingPending: true,
    });
    expect(calls).toEqual([
      'org:Residencial Ipê:u-1',
      'create:org-new:0:10',
      'grant:c-1:u-1:administrador',
    ]);
  });

  test('passes the whole building, fee, due day and pix to create', async () => {
    const { repo, created } = fakeCondos();
    const pix = {
      keyType: 'cpf',
      key: '529.982.247-25',
      receiverName: 'Condominio Ipe',
      city: 'Sao Paulo',
    };

    await createMyCondominium(repo, verifiedUser, {
      name: 'Ipê',
      structure: { blocks: [{ name: null, floors: 4, perFloor: 4 }] },
      monthlyFeeCents: 35000,
      dueDay: 10,
      pix,
    });

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      monthlyFeeCents: 35000,
      dueDay: 10,
      pix: { ...pix, key: '52998224725' },
    });
    expect(created[0]?.apartments).toHaveLength(16);
  });

  test('without a structure creates no apartments and no pix', async () => {
    const { repo, created } = fakeCondos();

    await createMyCondominium(repo, verifiedUser, { name: 'Ipê' });

    expect(created[0]).toMatchObject({ apartments: [], pix: null });
  });

  test.each([
    { blocks: [] },
    { blocks: [{ name: null, floors: 61, perFloor: 1 }] },
    {
      blocks: [
        { name: null, floors: 1, perFloor: 1 },
        { name: 'B', floors: 1, perFloor: 1 },
      ],
    },
  ])('rejects the invalid structure %p', async (structure) => {
    const { repo, calls } = fakeCondos();

    await expect(
      createMyCondominium(repo, verifiedUser, { name: 'Ipê', structure }),
    ).rejects.toBeInstanceOf(CondoValidationError);
    expect(calls).toEqual([]);
  });

  test('reuses the organization the user already owns', async () => {
    const { repo, calls } = fakeCondos({ id: 'org-existing' });

    const summary = await createMyCondominium(repo, verifiedUser, { name: 'Segundo' });

    expect(summary).toMatchObject({ organizationId: 'org-existing', orgRole: 'owner' });
    expect(calls).toEqual(['create:org-existing:0:10', 'grant:c-1:u-1:administrador']);
  });

  test('creates the condominium in the organization the user is a member of', async () => {
    const { repo, calls } = fakeCondos(null, { id: 'org-team' });

    const summary = await createMyCondominium(repo, verifiedUser, { name: 'Terceiro' });

    expect(summary).toMatchObject({
      organizationId: 'org-team',
      orgRole: 'member',
      condoRole: 'administrador',
    });
    expect(calls).toEqual(['create:org-team:0:10', 'grant:c-1:u-1:administrador']);
  });

  test('prefers the owned organization over a membership', async () => {
    const { repo } = fakeCondos({ id: 'org-own' }, { id: 'org-team' });

    const summary = await createMyCondominium(repo, verifiedUser, { name: 'Quarto' });

    expect(summary).toMatchObject({ organizationId: 'org-own', orgRole: 'owner' });
  });

  test('rejects an unconfirmed e-mail', async () => {
    const { repo, calls } = fakeCondos();

    const error = await createMyCondominium(
      repo,
      { ...verifiedUser, emailVerifiedAt: null },
      { name: 'X' },
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EmailNotConfirmedError);
    expect(error).toMatchObject({
      status: 403,
      message: 'Confirme seu e-mail antes de criar um condomínio',
    });
    expect(calls).toEqual([]);
  });

  test('lets a legacy username user without e-mail create one', async () => {
    const { repo } = fakeCondos();

    const summary = await createMyCondominium(
      repo,
      { ...verifiedUser, email: null, username: 'admin', emailVerifiedAt: null },
      { name: 'X' },
    );

    expect(summary.role).toBe('admin');
  });

  test.each([undefined, null, {}, { name: '   ' }, { name: 'a'.repeat(81) }, { name: 3 }])(
    'rejects an invalid body %p',
    async (body) => {
      const { repo, calls } = fakeCondos();

      await expect(createMyCondominium(repo, verifiedUser, body)).rejects.toBeInstanceOf(
        CondoValidationError,
      );
      expect(calls).toEqual([]);
    },
  );
});
