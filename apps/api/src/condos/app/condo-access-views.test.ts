import type { CondoAccess } from '../domain/condo-access';

import { listMyCondos, resolveCondoAccess } from './condo-access-views';

const ADMIN_PERMISSIONS = [
  'view_building',
  'publish_notices',
  'manage_residents',
  'manage_money',
  'manage_fees',
  'manage_condo',
  'view_activity',
];
const SINDICO_PERMISSIONS = ADMIN_PERMISSIONS.slice(0, 4);

const access = (overrides: Partial<CondoAccess>): CondoAccess => ({
  condominiumId: 'c-1',
  name: 'Condomínio Um',
  role: 'administrador',
  residentId: null,
  organizationId: 'org-1',
  orgRole: null,
  ...overrides,
});

describe('listMyCondos', () => {
  test('maps every reachable grant to its default view, leaving a bare morador row out', async () => {
    const condos = {
      listForUser: async () => [
        access({ condominiumId: 'c-1', name: 'A', role: 'administrador', orgRole: 'owner' }),
        access({ condominiumId: 'c-2', name: 'B', role: 'sindico', organizationId: 'org-2' }),
        access({ condominiumId: 'c-3', name: 'C', role: 'morador', residentId: 'r-1' }),
        access({ condominiumId: 'c-4', name: 'D', role: 'morador', residentId: null }),
      ],
    };

    const result = await listMyCondos(condos, 'u-1');

    expect(result).toEqual([
      {
        id: 'c-1',
        name: 'A',
        role: 'admin',
        condoRole: 'administrador',
        permissions: ADMIN_PERMISSIONS,
        hasHome: false,
        organizationId: 'org-1',
        orgRole: 'owner',
      },
      {
        id: 'c-2',
        name: 'B',
        role: 'admin',
        condoRole: 'sindico',
        permissions: SINDICO_PERMISSIONS,
        hasHome: false,
        organizationId: 'org-2',
        orgRole: null,
      },
      {
        id: 'c-3',
        name: 'C',
        role: 'resident',
        condoRole: 'morador',
        permissions: [],
        hasHome: false,
        organizationId: 'org-1',
        orgRole: null,
      },
    ]);
  });

  test('listMyCondos reports hasHome and permissions', async () => {
    const condos = {
      listForUser: async () => [access({ role: 'sindico', residentId: 'r-1' })],
    };

    const [summary] = await listMyCondos(condos, 'u-1');

    expect(summary).toMatchObject({ role: 'admin', condoRole: 'sindico', hasHome: true });
    expect(summary?.permissions).toHaveLength(4);
  });
});

describe('resolveCondoAccess', () => {
  const resolverFor = (found: CondoAccess | null) =>
    resolveCondoAccess({ accessFor: async () => found });

  test('an administrador acts as admin with the user id as subject', async () => {
    expect(await resolverFor(access({ role: 'administrador' }))('u-1', 'c-1', null)).toEqual({
      role: 'admin',
      sub: 'u-1',
      condoRole: 'administrador',
      permissions: ADMIN_PERMISSIONS,
    });
  });

  test('a morador acts as resident with the resident id as subject', async () => {
    const found = access({ role: 'morador', residentId: 'r-7' });
    expect(await resolverFor(found)('u-1', 'c-1', null)).toEqual({
      role: 'resident',
      sub: 'r-7',
      condoRole: 'morador',
      permissions: [],
    });
  });

  test('a morador without a resident link has no access', async () => {
    const found = access({ role: 'morador', residentId: null });
    expect(await resolverFor(found)('u-1', 'c-1', null)).toBe(null);
  });

  test('sindico resolves to the staff view', async () => {
    expect(await resolverFor(access({ role: 'sindico' }))('u-1', 'c-1', null)).toMatchObject({
      role: 'admin',
      sub: 'u-1',
      condoRole: 'sindico',
    });
  });

  describe('view header', () => {
    const sindico = access({ role: 'sindico', residentId: 'r-1' });

    test('a sindico with a home asking for the resident view acts as that resident', async () => {
      expect(await resolverFor(sindico)('u-1', 'c-1', 'resident')).toEqual({
        role: 'resident',
        sub: 'r-1',
        condoRole: 'sindico',
        permissions: SINDICO_PERMISSIONS,
      });
    });

    test('the same sindico without the header acts as staff', async () => {
      expect(await resolverFor(sindico)('u-1', 'c-1', null)).toMatchObject({ role: 'admin' });
    });

    test('a staff role without a home ignores the resident view', async () => {
      const found = access({ role: 'administrador' });
      expect(await resolverFor(found)('u-1', 'c-1', 'resident')).toMatchObject({
        role: 'admin',
        sub: 'u-1',
      });
    });

    test('a pure morador asking for the admin view stays a resident', async () => {
      const found = access({ role: 'morador', residentId: 'r-7' });
      expect(await resolverFor(found)('u-1', 'c-1', 'admin')).toMatchObject({
        role: 'resident',
        sub: 'r-7',
      });
    });
  });

  test('no grant means no access', async () => {
    expect(await resolverFor(null)('u-1', 'c-1', null)).toBe(null);
  });

  test('passes the user and condominium through to the repository', async () => {
    const calls: [string, string][] = [];
    const resolve = resolveCondoAccess({
      accessFor: async (userId, condominiumId) => {
        calls.push([userId, condominiumId]);
        return null;
      },
    });

    await resolve('u-2', 'c-9', null);

    expect(calls).toEqual([['u-2', 'c-9']]);
  });
});
