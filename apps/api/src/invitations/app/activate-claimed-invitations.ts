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
): Promise<void> {
  const { condominiumId, residentId } = invitation;
  await deps.condos.grant({ condominiumId, userId, role: 'morador', residentId });
  await deps.invitations.accept(invitation.id, at);
  await deps.condos.deactivateResidentGrants(condominiumId, residentId, userId);
}

export interface ActivateClaimedDeps extends GrantInvitationDeps {
  users: Pick<UserRepository, 'findById'>;
  residentsFor: ResidentsFor;
  now: () => Date;
}

async function residentIsActive(deps: ActivateClaimedDeps, invitation: Invitation) {
  const resident = await deps.residentsFor(invitation.condominiumId).getById(invitation.residentId);
  return resident?.active === true;
}

export async function activateClaimedInvitations(
  deps: ActivateClaimedDeps,
  userId: string,
): Promise<void> {
  const user = await deps.users.findById(userId);
  if (!user || user.email === null || user.emailVerifiedAt === null) return;
  const now = deps.now();
  for (const invitation of await deps.invitations.claimedBy(userId, now)) {
    if (await residentIsActive(deps, invitation)) {
      await grantInvitation(deps, invitation, userId, now);
    }
  }
}
