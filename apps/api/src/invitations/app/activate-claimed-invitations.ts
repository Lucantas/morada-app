import type { CondoRepository } from '../../condos/domain/condo-repository';
import type { UserRepository } from '../../users/domain/user-repository';
import type { Invitation } from '../domain/invitation';
import type { InvitationTokenRepository } from '../domain/invitation-repository';

import { invitationTarget, type UsableInvitationDeps } from './usable-invitation';

export interface GrantInvitationDeps {
  invitations: InvitationTokenRepository;
  condos: Pick<
    CondoRepository,
    'grant' | 'deactivateResidentGrants' | 'deactivateOtherSindicos' | 'addOrgMember'
  >;
}

async function applyGrant(
  condos: GrantInvitationDeps['condos'],
  invitation: Invitation,
  userId: string,
): Promise<void> {
  if (invitation.role === 'membro') {
    await condos.addOrgMember(invitation.organizationId, userId, invitation.orgRole);
    return;
  }
  const { condominiumId } = invitation;
  if (invitation.role === 'sindico') {
    await condos.grant({ condominiumId, userId, role: 'sindico', residentId: null });
    await condos.deactivateOtherSindicos(condominiumId, userId);
    return;
  }
  const { residentId } = invitation;
  await condos.grant({ condominiumId, userId, role: 'morador', residentId });
  await condos.deactivateResidentGrants(condominiumId, residentId, userId);
}

export async function grantInvitation(
  deps: GrantInvitationDeps,
  invitation: Invitation,
  userId: string,
  at: Date,
): Promise<boolean> {
  if (!(await deps.invitations.accept(invitation.id, userId, at))) return false;
  await applyGrant(deps.condos, invitation, userId);
  return true;
}

export interface ActivateClaimedDeps extends GrantInvitationDeps, UsableInvitationDeps {
  condos: GrantInvitationDeps['condos'] & UsableInvitationDeps['condos'];
  users: Pick<UserRepository, 'findById'>;
}

async function stillUsable(
  deps: ActivateClaimedDeps,
  invitation: Invitation,
  userEmail: string,
): Promise<boolean> {
  if (invitation.email !== null && invitation.email !== userEmail) return false;
  return (await invitationTarget(deps, invitation)) !== null;
}

export async function activateClaimedInvitations(
  deps: ActivateClaimedDeps,
  userId: string,
): Promise<void> {
  const user = await deps.users.findById(userId);
  if (!user || user.email === null || user.emailVerifiedAt === null) return;
  const now = deps.now();
  for (const invitation of await deps.invitations.claimedBy(userId, now)) {
    if (await stillUsable(deps, invitation, user.email)) {
      await grantInvitation(deps, invitation, userId, now);
    }
  }
}
