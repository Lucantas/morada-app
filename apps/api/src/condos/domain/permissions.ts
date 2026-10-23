import type { CondoRoleName } from './condominium';

export type Permission =
  | 'view_building'
  | 'publish_notices'
  | 'manage_residents'
  | 'manage_money'
  | 'manage_fees'
  | 'manage_condo'
  | 'view_activity';

const SINDICO_PERMISSIONS: readonly Permission[] = [
  'view_building',
  'publish_notices',
  'manage_residents',
  'manage_money',
];

const PERMISSIONS_BY_ROLE: Record<CondoRoleName, readonly Permission[]> = {
  administrador: [...SINDICO_PERMISSIONS, 'manage_fees', 'manage_condo', 'view_activity'],
  sindico: SINDICO_PERMISSIONS,
  morador: [],
};

export function permissionsFor(role: CondoRoleName): readonly Permission[] {
  return PERMISSIONS_BY_ROLE[role];
}

export function isStaff(role: CondoRoleName): boolean {
  return role === 'administrador' || role === 'sindico';
}
