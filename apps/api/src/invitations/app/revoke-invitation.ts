import type { ResidentRepository } from '../../residents/domain/resident-repository';
import { InvitationResidentNotFoundError } from '../domain/errors';
import type { CondoInvitationRepository } from '../domain/invitation-repository';

export async function revokeInvitation(
  deps: { invitations: CondoInvitationRepository; residents: ResidentRepository },
  residentId: string,
): Promise<void> {
  if (!(await deps.residents.getById(residentId))) {
    throw new InvitationResidentNotFoundError(residentId);
  }
  await deps.invitations.revoke(residentId);
}
