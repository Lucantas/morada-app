export type StoredInvitationStatus = 'pendente' | 'aceito' | 'revogado';
export type InvitationStatus = StoredInvitationStatus | 'expirado';

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InvitationRole = 'morador' | 'sindico' | 'membro';

export interface InvitationBase {
  id: string;
  email: string | null;
  status: InvitationStatus;
  expiresAt: Date;
  createdBy: string;
  claimedBy: string | null;
  acceptedAt: Date | null;
  createdAt: Date;
}

export type MoradorInvitation = InvitationBase & {
  role: 'morador';
  condominiumId: string;
  residentId: string;
};

export type SindicoInvitation = InvitationBase & {
  role: 'sindico';
  condominiumId: string;
  email: string;
};

export type MembroInvitation = InvitationBase & {
  role: 'membro';
  organizationId: string;
  orgRole: 'owner' | 'member';
  email: string;
};

export type Invitation = MoradorInvitation | SindicoInvitation | MembroInvitation;

export function effectiveStatus(
  stored: StoredInvitationStatus,
  expiresAt: Date,
  now: Date,
): InvitationStatus {
  return stored === 'pendente' && expiresAt.getTime() <= now.getTime() ? 'expirado' : stored;
}

export function invitationExpiry(now: Date): Date {
  return new Date(now.getTime() + INVITATION_TTL_MS);
}
