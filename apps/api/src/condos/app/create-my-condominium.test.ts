import { CondoValidationError, EmailNotConfirmedError } from '../domain/errors';
import type { CondoRepository } from '../domain/condo-repository';
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

function fakeCondos(owned: { id: string } | null = null) {
  const calls: string[] = [];
  const repo: Pick<
    CondoRepository,
    'ownedOrganization' | 'createOrganization' | 'create' | 'grant'
  > = {
    ownedOrganization: async () => owned,
    createOrganization: async (input) => {
      calls.push(`org:${input.name}:${input.ownerUserId}`);
      return { id: 'org-new' };
    },
    create: async (input) => {
      calls.push(`create:${input.organizationId}:${input.monthlyFeeCents}:${input.dueDay}`);
      return { id: 'c-1', organizationId: input.organizationId, name: input.name, active: true };
    },
    grant: async (grant) => {
      calls.push(`grant:${grant.condominiumId}:${grant.userId}:${grant.role}`);
    },
  };
  return { repo, calls };
}

describe('createMyCondominium', () => {
  test('creates the organization, the condominium and the administrador grant', async () => {
    const { repo, calls } = fakeCondos();

    const summary = await createMyCondominium(repo, verifiedUser, { name: '  Residencial Ipê ' });

    expect(summary).toEqual({ id: 'c-1', name: 'Residencial Ipê', role: 'admin' });
    expect(calls).toEqual([
      'org:Residencial Ipê:u-1',
      'create:org-new:0:10',
      'grant:c-1:u-1:administrador',
    ]);
  });

  test('reuses the organization the user already owns', async () => {
    const { repo, calls } = fakeCondos({ id: 'org-existing' });

    await createMyCondominium(repo, verifiedUser, { name: 'Segundo' });

    expect(calls).toEqual(['create:org-existing:0:10', 'grant:c-1:u-1:administrador']);
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
