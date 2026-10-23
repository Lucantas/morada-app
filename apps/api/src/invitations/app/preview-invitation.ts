import type { UserRepository } from '../../users/domain/user-repository';
import type { InvitationRole } from '../domain/invitation';

import { findUsableInvitation, type UsableInvitationDeps } from './usable-invitation';

export interface InvitationPreview {
  role: InvitationRole;
  targetName: string;
  condoName?: string;
  residentName?: string;
  apt?: string;
  email: string | null;
  accountExists: boolean;
}

export interface PreviewInvitationDeps extends UsableInvitationDeps {
  users: Pick<UserRepository, 'existsByEmail'>;
}

export async function previewInvitation(
  deps: PreviewInvitationDeps,
  token: string,
): Promise<InvitationPreview> {
  const { invitation, target } = await findUsableInvitation(deps, token);
  const accountExists =
    invitation.email === null ? false : await deps.users.existsByEmail(invitation.email);
  const common = { role: invitation.role, email: invitation.email, accountExists };
  if (target.kind === 'org') return { ...common, targetName: target.organization.name };
  const condoName = target.condo.name;
  const resident = target.resident
    ? { residentName: target.resident.name, apt: target.resident.apt }
    : {};
  return { ...common, targetName: condoName, condoName, ...resident };
}
