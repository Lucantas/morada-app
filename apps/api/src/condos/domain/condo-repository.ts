import type { CondoAccess, OrgRoleName } from './condo-access';
import type { Condominium, CondoRoleName } from './condominium';

export interface CreateCondominiumInput {
  organizationId: string;
  name: string;
  monthlyFeeCents: number;
  dueDay: number;
}

export interface CondoGrant {
  condominiumId: string;
  userId: string;
  role: CondoRoleName;
  residentId: string | null;
}

export interface CondoSindico {
  userId: string;
  name: string | null;
  email: string | null;
}

export interface CondoRepository {
  listForUser(userId: string): Promise<CondoAccess[]>;
  accessFor(userId: string, condominiumId: string): Promise<CondoAccess | null>;
  getById(condominiumId: string): Promise<Condominium | null>;
  isOperational(condominiumId: string): Promise<boolean>;
  rename(condominiumId: string, name: string): Promise<Condominium>;
  create(input: CreateCondominiumInput): Promise<Condominium>;
  ownedOrganization(userId: string): Promise<{ id: string } | null>;
  createOrganization(input: { name: string; ownerUserId: string }): Promise<{ id: string }>;
  grant(input: CondoGrant): Promise<void>;
  deactivateResidentGrants(
    condominiumId: string,
    residentId: string,
    exceptUserId: string,
  ): Promise<void>;
  deactivateOtherSindicos(condominiumId: string, keepUserId: string): Promise<void>;
  currentSindico(condominiumId: string): Promise<CondoSindico | null>;
  removeSindico(condominiumId: string): Promise<void>;
  addOrgMember(organizationId: string, userId: string, role: OrgRoleName): Promise<void>;
  getOrganization(organizationId: string): Promise<{ id: string; name: string } | null>;
}
