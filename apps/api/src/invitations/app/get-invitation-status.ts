import type { ResidentRepository } from '../../residents/domain/resident-repository';
import { InvitationResidentNotFoundError } from '../domain/errors';
import type { InvitationStatus } from '../domain/invitation';
import type { CondoInvitationRepository } from '../domain/invitation-repository';

export interface InvitationStatusView {
  status: InvitationStatus;
  email: string | null;
  expiresAt: Date;
}

export async function getInvitationStatus(
  deps: { invitations: CondoInvitationRepository; residents: ResidentRepository },
  residentId: string,
  now: Date,
): Promise<InvitationStatusView | null> {
  if (!(await deps.residents.getById(residentId))) {
    throw new InvitationResidentNotFoundError(residentId);
  }
  const invitation = await deps.invitations.latestForResident(residentId, now);
  return invitation
    ? { status: invitation.status, email: invitation.email, expiresAt: invitation.expiresAt }
    : null;
}
