import type {
  CondoRoleName as PlatformCondoRoleName,
  Permission as PlatformPermission,
} from '../../platform/auth';

import type { CondoRoleName } from './condominium';
import { isStaff, permissionsFor, type Permission } from './permissions';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

describe('permissionsFor', () => {
  test('administrador has every permission', () => {
    expect(permissionsFor('administrador')).toEqual([
      'view_building',
      'publish_notices',
      'manage_residents',
      'manage_money',
      'manage_fees',
      'manage_condo',
      'view_activity',
    ]);
  });

  test('sindico manages the building but not fees, condo or activity', () => {
    expect(permissionsFor('sindico')).toEqual([
      'view_building',
      'publish_notices',
      'manage_residents',
      'manage_money',
    ]);
  });

  test('morador has no staff permission', () => expect(permissionsFor('morador')).toEqual([]));
});

describe('isStaff', () => {
  test('administrador and sindico are staff, morador is not', () => {
    expect(isStaff('administrador')).toBe(true);
    expect(isStaff('sindico')).toBe(true);
    expect(isStaff('morador')).toBe(false);
  });
});

test('the platform shares the permission and condo role vocabulary', () => {
  const samePermissions: Same<Permission, PlatformPermission> = true;
  const sameRoles: Same<CondoRoleName, PlatformCondoRoleName> = true;

  expect([samePermissions, sameRoles]).toEqual([true, true]);
});
