import type { OrgCondo, OrgMember, OrgRole, Organization } from './organization';

export interface OrgMembership {
  role: OrgRole;
  active: boolean;
}

export interface OrganizationRepository {
  isActiveOwner(organizationId: string, userId: string): Promise<boolean>;
  get(organizationId: string): Promise<Organization | null>;
  rename(organizationId: string, name: string): Promise<Organization>;
  members(organizationId: string): Promise<OrgMember[]>;
  condos(organizationId: string): Promise<OrgCondo[]>;
  member(organizationId: string, userId: string): Promise<OrgMembership | null>;
  deactivateMember(organizationId: string, userId: string): Promise<void>;
  assignCondos(
    organizationId: string,
    userId: string,
    condoIds: readonly string[],
  ): Promise<string[]>;
}
