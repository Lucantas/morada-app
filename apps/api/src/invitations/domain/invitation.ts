export type StoredInvitationStatus = 'pendente' | 'aceito' | 'revogado';
export type InvitationStatus = StoredInvitationStatus | 'expirado';

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface Invitation {
  id: string;
  condominiumId: string;
  residentId: string;
  role: 'morador';
  email: string | null;
  status: InvitationStatus;
  expiresAt: Date;
  createdBy: string;
  claimedBy: string | null;
  acceptedAt: Date | null;
  createdAt: Date;
}

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
