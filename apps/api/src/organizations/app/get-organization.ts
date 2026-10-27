import type { OrgInvitationRepository } from '../../invitations/domain/invitation-repository';
import { OrganizationNotFoundError } from '../domain/errors';
import type { OrgCondo, OrgMember, OrgRole } from '../domain/organization';
import type { OrganizationRepository } from '../domain/organization-repository';

export interface OrganizationView {
  id: string;
  name: string;
  members: OrgMember[];
  condos: OrgCondo[];
  invitations: { id: string; email: string; orgRole: OrgRole; expiresAt: Date }[];
}

export interface GetOrganizationDeps {
  organizations: Pick<OrganizationRepository, 'get' | 'members' | 'condos'>;
  invitations: Pick<OrgInvitationRepository, 'pending'>;
}

export async function getOrganization(
  deps: GetOrganizationDeps,
  organizationId: string,
  now: Date,
): Promise<OrganizationView> {
  const organization = await deps.organizations.get(organizationId);
  if (!organization) throw new OrganizationNotFoundError();
  const [members, condos, pending] = await Promise.all([
    deps.organizations.members(organizationId),
    deps.organizations.condos(organizationId),
    deps.invitations.pending(organizationId, now),
  ]);
  return {
    id: organization.id,
    name: organization.name,
    members,
    condos,
    invitations: pending.map(({ id, email, orgRole, expiresAt }) => ({
      id,
      email,
      orgRole,
      expiresAt,
    })),
  };
}
