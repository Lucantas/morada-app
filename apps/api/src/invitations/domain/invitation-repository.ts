import type {
  Invitation,
  MembroInvitation,
  MoradorInvitation,
  SindicoInvitation,
} from './invitation';

export interface CreateInvitationInput {
  residentId: string;
  email: string | null;
  tokenHash: string;
  expiresAt: Date;
  createdBy: string;
}

export interface CreateSindicoInvitationInput {
  email: string;
  tokenHash: string;
  expiresAt: Date;
  createdBy: string;
}

export interface CreateMembroInvitationInput {
  organizationId: string;
  email: string;
  orgRole: 'owner' | 'member';
  tokenHash: string;
  expiresAt: Date;
  createdBy: string;
}

export interface OrgInvitationRepository {
  pending(organizationId: string, now?: Date): Promise<MembroInvitation[]>;
  create(input: CreateMembroInvitationInput, now?: Date): Promise<MembroInvitation>;
  revoke(organizationId: string, id: string): Promise<boolean>;
}

export interface CondoInvitationRepository {
  latestForResident(residentId: string, now?: Date): Promise<MoradorInvitation | null>;
  create(input: CreateInvitationInput, now?: Date): Promise<MoradorInvitation>;
  revoke(residentId: string): Promise<void>;
  latestSindico(now?: Date): Promise<SindicoInvitation | null>;
  createSindico(input: CreateSindicoInvitationInput, now?: Date): Promise<SindicoInvitation>;
  revokeSindico(): Promise<void>;
}

export interface InvitationTokenRepository {
  findByTokenHash(hash: string, now?: Date): Promise<Invitation | null>;
  claim(id: string, userId: string): Promise<boolean>;
  accept(id: string, userId: string, at: Date): Promise<boolean>;
  releaseClaims(userId: string): Promise<void>;
  claimedBy(userId: string, now?: Date): Promise<Invitation[]>;
}
