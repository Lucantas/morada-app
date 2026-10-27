import type { CondoInvitationRepository } from '../domain/invitation-repository';

export async function revokeSindicoInvitation(deps: {
  invitations: Pick<CondoInvitationRepository, 'revokeSindico'>;
}): Promise<void> {
  await deps.invitations.revokeSindico();
}
