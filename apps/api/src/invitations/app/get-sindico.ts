import type { CondoRepository } from '../../condos/domain/condo-repository';
import type { CondoInvitationRepository } from '../domain/invitation-repository';

import type { InvitationStatusView } from './get-invitation-status';

export interface SindicoView {
  current: { name: string | null; email: string | null } | null;
  invitation: InvitationStatusView | null;
}

export async function getSindico(
  deps: {
    invitations: Pick<CondoInvitationRepository, 'latestSindico'>;
    condos: Pick<CondoRepository, 'currentSindico'>;
  },
  condominiumId: string,
  now: Date,
): Promise<SindicoView> {
  const current = await deps.condos.currentSindico(condominiumId);
  const invitation = await deps.invitations.latestSindico(now);
  return {
    current: current ? { name: current.name, email: current.email } : null,
    invitation: invitation
      ? { status: invitation.status, email: invitation.email, expiresAt: invitation.expiresAt }
      : null,
  };
}
