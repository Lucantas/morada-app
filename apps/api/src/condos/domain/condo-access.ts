import type { CondoRoleName } from './condominium';

export type OrgRoleName = 'owner' | 'member';

export type CondoAccess = {
  condominiumId: string;
  name: string;
  role: CondoRoleName;
  residentId: string | null;
  organizationId: string;
  orgRole: OrgRoleName | null;
  onboardingPending: boolean;
};

const ROLE_RANK: Record<CondoRoleName, number> = { administrador: 3, sindico: 2, morador: 1 };

function mergeGrants(current: CondoAccess, next: CondoAccess): CondoAccess {
  const winner = ROLE_RANK[next.role] > ROLE_RANK[current.role] ? next : current;
  return {
    ...winner,
    residentId: current.residentId ?? next.residentId,
    orgRole: current.orgRole ?? next.orgRole,
  };
}

export function resolveAccess(grants: readonly CondoAccess[]): CondoAccess[] {
  const byCondo = grants.reduce((acc, grant) => {
    const current = acc.get(grant.condominiumId);
    return new Map(acc).set(grant.condominiumId, current ? mergeGrants(current, grant) : grant);
  }, new Map<string, CondoAccess>());
  return [...byCondo.values()].sort(
    (a, b) =>
      a.name.localeCompare(b.name, 'pt-BR') || a.condominiumId.localeCompare(b.condominiumId),
  );
}
