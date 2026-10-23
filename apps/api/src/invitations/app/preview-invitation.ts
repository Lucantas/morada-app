import type { UserRepository } from '../../users/domain/user-repository';

import { findUsableInvitation, type UsableInvitationDeps } from './usable-invitation';

export interface InvitationPreview {
  condoName: string;
  residentName: string;
  apt: string;
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
  const { invitation, resident, condo } = await findUsableInvitation(deps, token);
  const accountExists =
    invitation.email === null ? false : await deps.users.existsByEmail(invitation.email);
  return {
    condoName: condo.name,
    residentName: resident.name,
    apt: resident.apt,
    email: invitation.email,
    accountExists,
  };
}
