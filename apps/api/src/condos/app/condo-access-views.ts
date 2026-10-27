import type { Role } from '../../platform/auth';
import type { ResolvedAccess } from '../../platform/condo-scope';
import type { CondoAccess, OrgRoleName } from '../domain/condo-access';
import type { CondoRepository } from '../domain/condo-repository';
import type { CondoRoleName } from '../domain/condominium';
import { isStaff, permissionsFor, type Permission } from '../domain/permissions';

export type CondoSummary = {
  id: string;
  name: string;
  role: Role;
  condoRole: CondoRoleName;
  permissions: Permission[];
  hasHome: boolean;
  organizationId: string;
  orgRole: OrgRoleName | null;
  onboardingPending: boolean;
};

function viewFor(
  userId: string,
  access: CondoAccess,
  requestedView: Role | null,
): Pick<ResolvedAccess, 'role' | 'sub'> | null {
  if (access.role === 'morador') {
    return access.residentId === null ? null : { role: 'resident', sub: access.residentId };
  }
  if (requestedView === 'resident' && access.residentId !== null) {
    return { role: 'resident', sub: access.residentId };
  }
  return { role: 'admin', sub: userId };
}

function resolvedFor(
  userId: string,
  access: CondoAccess,
  requestedView: Role | null,
): ResolvedAccess | null {
  const view = viewFor(userId, access, requestedView);
  if (!view) return null;
  return { ...view, condoRole: access.role, permissions: permissionsFor(access.role) };
}

export function summaryOf(access: CondoAccess, role: Role): CondoSummary {
  return {
    id: access.condominiumId,
    name: access.name,
    role,
    condoRole: access.role,
    permissions: [...permissionsFor(access.role)],
    hasHome: isStaff(access.role) && access.residentId !== null,
    organizationId: access.organizationId,
    orgRole: access.orgRole,
    onboardingPending: access.onboardingPending,
  };
}

export async function listMyCondos(
  condos: Pick<CondoRepository, 'listForUser'>,
  userId: string,
): Promise<CondoSummary[]> {
  const accesses = await condos.listForUser(userId);
  return accesses.flatMap((access) => {
    const resolved = resolvedFor(userId, access, null);
    return resolved ? [summaryOf(access, resolved.role)] : [];
  });
}

export function resolveCondoAccess(
  condos: Pick<CondoRepository, 'accessFor'>,
): (
  userId: string,
  condominiumId: string,
  requestedView: Role | null,
) => Promise<ResolvedAccess | null> {
  return async (userId, condominiumId, requestedView) => {
    const access = await condos.accessFor(userId, condominiumId);
    return access ? resolvedFor(userId, access, requestedView) : null;
  };
}
