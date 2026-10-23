import type { Role } from '../../platform/auth';
import type { ResolvedAccess } from '../../platform/condo-scope';
import type { CondoAccess } from '../domain/condo-access';
import type { CondoRepository } from '../domain/condo-repository';

export type CondoSummary = { id: string; name: string; role: Role };

function resolvedFor(userId: string, access: CondoAccess): ResolvedAccess | null {
  if (access.role === 'administrador') return { role: 'admin', sub: userId };
  if (access.role === 'morador' && access.residentId !== null) {
    return { role: 'resident', sub: access.residentId };
  }
  return null;
}

export async function listMyCondos(
  condos: Pick<CondoRepository, 'listForUser'>,
  userId: string,
): Promise<CondoSummary[]> {
  const accesses = await condos.listForUser(userId);
  return accesses.flatMap((access) => {
    const resolved = resolvedFor(userId, access);
    return resolved ? [{ id: access.condominiumId, name: access.name, role: resolved.role }] : [];
  });
}

export function resolveCondoAccess(
  condos: Pick<CondoRepository, 'accessFor'>,
): (userId: string, condominiumId: string) => Promise<ResolvedAccess | null> {
  return async (userId, condominiumId) => {
    const access = await condos.accessFor(userId, condominiumId);
    return access ? resolvedFor(userId, access) : null;
  };
}
