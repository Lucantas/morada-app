import type { CondoAccess } from './condos/domain/condo-access';
import type { CondoGrant, CondoRepository } from './condos/domain/condo-repository';
import type { Condominium } from './condos/domain/condominium';
import type { PasswordHasher } from './users/domain/password-hasher';
import type { User } from './users/domain/user';
import type { UserRepository } from './users/domain/user-repository';

import { adminCredentials, seedAdmin } from './seed-data';

jest.mock('./platform/config', () => ({
  config: { isProduction: false },
}));

import { config } from './platform/config';

function fakeRepo(users: User[] = []): UserRepository {
  const map = new Map(users.map((u) => [u.username, u]));
  return {
    findById: async (id) => [...map.values()].find((u) => u.id === id) ?? null,
    findByEmail: async (email) => [...map.values()].find((u) => u.email === email) ?? null,
    existsByEmail: async (email) => [...map.values()].some((u) => u.email === email),
    markEmailVerified: async () => undefined,
    markEmailVerifiedAndBump: async () => 1,
    setPasswordHashAndBump: async () => 1,
    updateCredentialsAndBump: async () => 1,
    sessionVersionOf: async () => 0,
    findByUsername: async (username) => map.get(username) ?? null,
    findByResidentId: async (residentId) =>
      [...map.values()].find((u) => u.residentId === residentId) ?? null,
    existsByUsername: async (username) => map.has(username),
    existsByResidentId: async (residentId) =>
      [...map.values()].some((u) => u.residentId === residentId),
    hasAny: async () => map.size > 0,
    save: async (u) => {
      map.set(u.username, u);
      return u;
    },
  };
}

interface FakeCondos extends CondoRepository {
  organizations: { id: string; name: string; ownerUserId: string }[];
  condominiums: (Condominium & { monthlyFeeCents: number; dueDay: number })[];
  grants: CondoGrant[];
}

function fakeCondos(initial: CondoAccess[] = []): FakeCondos {
  const organizations: FakeCondos['organizations'] = [];
  const condominiums: FakeCondos['condominiums'] = [];
  const grants: CondoGrant[] = [];
  const accessOf = (grant: CondoGrant): CondoAccess => ({
    condominiumId: grant.condominiumId,
    name: condominiums.find((c) => c.id === grant.condominiumId)?.name ?? '',
    role: grant.role,
    residentId: grant.residentId,
  });
  return {
    organizations,
    condominiums,
    grants,
    listForUser: async (userId) => [
      ...initial,
      ...grants.filter((g) => g.userId === userId).map(accessOf),
    ],
    accessFor: async () => null,
    getById: async (id) => condominiums.find((c) => c.id === id) ?? null,
    rename: async () => {
      throw new Error('not used');
    },
    create: async (input) => {
      const condo = {
        id: `condo-${condominiums.length + 1}`,
        organizationId: input.organizationId,
        name: input.name,
        active: true,
        monthlyFeeCents: input.monthlyFeeCents,
        dueDay: input.dueDay,
      };
      condominiums.push(condo);
      return condo;
    },
    ownedOrganization: async () => null,
    createOrganization: async (input) => {
      const org = { id: `org-${organizations.length + 1}`, ...input };
      organizations.push(org);
      return { id: org.id };
    },
    grant: async (grant) => {
      grants.push(grant);
    },
    deactivateResidentGrants: async () => undefined,
    isOperational: async () => true,
  };
}

const noopHasher: PasswordHasher = {
  hash: (plain) => Promise.resolve(`hash:${plain}`),
  verify: (plain, hash) => Promise.resolve(hash === `hash:${plain}`),
};

const existingResident: User = {
  id: 'u-1',
  username: 'maria302',
  passwordHash: 'existing-hash',
  role: 'resident',
  residentId: 'r-1',
  email: null,
  name: null,
  emailVerifiedAt: null,
  sessionVersion: 0,
};

describe('seedAdmin', () => {
  afterEach(() => {
    (config as { isProduction: boolean }).isProduction = false;
  });

  test('seeds the admin when no user exists yet (non-production)', async () => {
    const repo = fakeRepo([]);
    await seedAdmin(repo, fakeCondos(), noopHasher);
    expect(await repo.findByUsername(adminCredentials.username)).not.toBeNull();
  });

  test('is a no-op when the admin already exists (non-production)', async () => {
    const existingAdmin: User = {
      id: 'u-admin',
      username: adminCredentials.username,
      passwordHash: 'existing-hash',
      role: 'admin',
      residentId: null,
      email: null,
      name: null,
      emailVerifiedAt: null,
      sessionVersion: 0,
    };
    const repo = fakeRepo([existingAdmin]);
    await seedAdmin(repo, fakeCondos(), noopHasher);
    expect(await repo.findByUsername(adminCredentials.username)).toEqual(existingAdmin);
  });

  test('seeds the admin alongside other users when not in production', async () => {
    const repo = fakeRepo([existingResident]);
    await seedAdmin(repo, fakeCondos(), noopHasher);
    expect(await repo.findByUsername(adminCredentials.username)).not.toBeNull();
  });

  test('seeds normally in production when the database is empty', async () => {
    (config as { isProduction: boolean }).isProduction = true;
    const repo = fakeRepo([]);
    await seedAdmin(repo, fakeCondos(), noopHasher);
    expect(await repo.findByUsername(adminCredentials.username)).not.toBeNull();
  });

  test('is a no-op in production when the admin already exists', async () => {
    (config as { isProduction: boolean }).isProduction = true;
    const existingAdmin: User = {
      id: 'u-admin',
      username: adminCredentials.username,
      passwordHash: 'existing-hash',
      role: 'admin',
      residentId: null,
      email: null,
      name: null,
      emailVerifiedAt: null,
      sessionVersion: 0,
    };
    const repo = fakeRepo([existingAdmin]);
    await seedAdmin(repo, fakeCondos(), noopHasher);
    expect(await repo.findByUsername(adminCredentials.username)).toEqual(existingAdmin);
  });

  test('throws in production when other users exist but not the admin, and does not save', async () => {
    (config as { isProduction: boolean }).isProduction = true;
    const saveSpy = jest.fn(async (u: User) => u);
    const repo: UserRepository = {
      findById: async () => null,
      findByEmail: async () => null,
      existsByEmail: async () => false,
      markEmailVerified: async () => undefined,
      markEmailVerifiedAndBump: async () => 1,
      setPasswordHashAndBump: async () => 1,
      updateCredentialsAndBump: async () => 1,
      sessionVersionOf: async () => 0,
      findByUsername: async (username) =>
        username === existingResident.username ? existingResident : null,
      findByResidentId: async (residentId) =>
        residentId === existingResident.residentId ? existingResident : null,
      existsByUsername: async (username) => username === existingResident.username,
      existsByResidentId: async (residentId) => residentId === existingResident.residentId,
      hasAny: async () => true,
      save: saveSpy,
    };

    await expect(seedAdmin(repo, fakeCondos(), noopHasher)).rejects.toThrow(
      'Refusing to seed demo admin into a populated production database',
    );
    expect(saveSpy).not.toHaveBeenCalled();
  });

  test('seeds a demo condominium the admin administers when the admin has none', async () => {
    const condos = fakeCondos();

    await seedAdmin(fakeRepo([]), condos, noopHasher);

    expect(condos.organizations).toEqual([
      { id: 'org-1', name: 'Morada Demo', ownerUserId: 'u-admin' },
    ]);
    expect(condos.condominiums).toEqual([
      {
        id: 'condo-1',
        organizationId: 'org-1',
        name: 'Condomínio Demo',
        active: true,
        monthlyFeeCents: 15000,
        dueDay: 15,
      },
    ]);
    expect(condos.grants).toEqual([
      { condominiumId: 'condo-1', userId: 'u-admin', role: 'administrador', residentId: null },
    ]);
  });

  test('does not seed a demo condominium when the admin already administers one', async () => {
    const existingAdmin: User = {
      id: 'u-admin',
      username: adminCredentials.username,
      passwordHash: 'existing-hash',
      role: 'admin',
      residentId: null,
      email: null,
      name: null,
      emailVerifiedAt: null,
      sessionVersion: 0,
    };
    const condos = fakeCondos([
      { condominiumId: 'condo-legacy', name: 'Legado', role: 'administrador', residentId: null },
    ]);

    await seedAdmin(fakeRepo([existingAdmin]), condos, noopHasher);

    expect(condos.organizations).toEqual([]);
    expect(condos.condominiums).toEqual([]);
    expect(condos.grants).toEqual([]);
  });

  test('seeds the demo condominium for an existing admin without one', async () => {
    const existingAdmin: User = {
      id: 'u-admin',
      username: adminCredentials.username,
      passwordHash: 'existing-hash',
      role: 'admin',
      residentId: null,
      email: null,
      name: null,
      emailVerifiedAt: null,
      sessionVersion: 0,
    };
    const condos = fakeCondos();

    await seedAdmin(fakeRepo([existingAdmin]), condos, noopHasher);

    expect(condos.grants).toHaveLength(1);
  });
});
