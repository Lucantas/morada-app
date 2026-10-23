import type { CondoRepository } from '../../condos/domain/condo-repository';
import type { UserRepository } from '../../users/domain/user-repository';
import type { Invitation } from '../domain/invitation';
import type { InvitationTokenRepository } from '../domain/invitation-repository';

import type { ResidentsFor } from './usable-invitation';

export interface GrantInvitationDeps {
  invitations: InvitationTokenRepository;
  condos: Pick<CondoRepository, 'grant' | 'deactivateResidentGrants'>;
}

export async function grantInvitation(
  deps: GrantInvitationDeps,
  invitation: Invitation,
  userId: string,
  at: Date,
): Promise<boolean> {
  if (!(await deps.invitations.accept(invitation.id, userId, at))) return false;
  const { condominiumId, residentId } = invitation;
  await deps.condos.grant({ condominiumId, userId, role: 'morador', residentId });
  await deps.condos.deactivateResidentGrants(condominiumId, residentId, userId);
  return true;
}

export interface ActivateClaimedDeps extends GrantInvitationDeps {
  condos: GrantInvitationDeps['condos'] & Pick<CondoRepository, 'isOperational'>;
  users: Pick<UserRepository, 'findById'>;
  residentsFor: ResidentsFor;
  now: () => Date;
}

async function stillUsable(deps: ActivateClaimedDeps, invitation: Invitation): Promise<boolean> {
  const resident = await deps.residentsFor(invitation.condominiumId).getById(invitation.residentId);
  return resident?.active === true && (await deps.condos.isOperational(invitation.condominiumId));
}

export async function activateClaimedInvitations(
  deps: ActivateClaimedDeps,
  userId: string,
): Promise<void> {
  const user = await deps.users.findById(userId);
  if (!user || user.email === null || user.emailVerifiedAt === null) return;
  const now = deps.now();
  for (const invitation of await deps.invitations.claimedBy(userId, now)) {
    if (await stillUsable(deps, invitation)) await grantInvitation(deps, invitation, userId, now);
  }
}
