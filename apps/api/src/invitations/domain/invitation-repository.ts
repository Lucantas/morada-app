import type { Invitation } from './invitation';

export interface CreateInvitationInput {
  residentId: string;
  email: string | null;
  tokenHash: string;
  expiresAt: Date;
  createdBy: string;
}

export interface CondoInvitationRepository {
  latestForResident(residentId: string, now?: Date): Promise<Invitation | null>;
  create(input: CreateInvitationInput, now?: Date): Promise<Invitation>;
  revoke(residentId: string): Promise<void>;
}

export interface InvitationTokenRepository {
  findByTokenHash(hash: string, now?: Date): Promise<Invitation | null>;
  claim(id: string, userId: string): Promise<boolean>;
  accept(id: string, userId: string, at: Date): Promise<boolean>;
  releaseClaims(userId: string): Promise<void>;
  claimedBy(userId: string, now?: Date): Promise<Invitation[]>;
}
