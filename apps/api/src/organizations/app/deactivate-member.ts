import {
  OrgMemberNotFoundError,
  OwnerDeactivationError,
  SelfDeactivationError,
} from '../domain/errors';
import type { OrganizationRepository } from '../domain/organization-repository';

export async function deactivateMember(
  organizations: Pick<OrganizationRepository, 'member' | 'deactivateMember'>,
  organizationId: string,
  actorId: string,
  userId: string,
): Promise<void> {
  if (actorId === userId) throw new SelfDeactivationError();
  const membership = await organizations.member(organizationId, userId);
  if (!membership) throw new OrgMemberNotFoundError();
  if (membership.role === 'owner') throw new OwnerDeactivationError();
  await organizations.deactivateMember(organizationId, userId);
}
