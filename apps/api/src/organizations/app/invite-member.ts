import { z } from 'zod';

import { trySend, type CreatedInvitation } from '../../invitations/app/create-invitation';
import { invitationExpiry } from '../../invitations/domain/invitation';
import type { OrgInvitationRepository } from '../../invitations/domain/invitation-repository';
import { membroInvitationWhatsappUrl } from '../../invitations/domain/whatsapp';
import type { EmailSender } from '../../platform/email/email-sender';
import { generateToken, hashToken } from '../../platform/tokens';
import { invitationLink, membroInvitationMessage } from '../../users/app/emails';
import { emailSchema } from '../../users/domain/email';
import { OrgInvitationNotFoundError, OrganizationNotFoundError } from '../domain/errors';
import { orgRoleSchema } from '../domain/organization';
import type { OrganizationRepository } from '../domain/organization-repository';

const inviteBodySchema = z.object({
  email: emailSchema,
  orgRole: orgRoleSchema,
  phone: z.string().max(40).optional(),
});

export interface InviteMemberDeps {
  organizations: Pick<OrganizationRepository, 'get'>;
  invitations: Pick<OrgInvitationRepository, 'create'>;
  email: EmailSender;
  appUrl: string;
  now: () => Date;
}

export async function inviteMember(
  deps: InviteMemberDeps,
  organizationId: string,
  createdBy: string,
  input: unknown,
): Promise<CreatedInvitation> {
  const body = inviteBodySchema.parse(input);
  const organization = await deps.organizations.get(organizationId);
  if (!organization) throw new OrganizationNotFoundError();

  const now = deps.now();
  const token = generateToken();
  const invitation = await deps.invitations.create(
    {
      organizationId,
      email: body.email,
      orgRole: body.orgRole,
      tokenHash: hashToken(token),
      expiresAt: invitationExpiry(now),
      createdBy,
    },
    now,
  );
  const link = invitationLink(deps.appUrl, token);
  const emailSent = await trySend(
    deps.email,
    membroInvitationMessage(invitation.email, organization.name, link),
  );

  return {
    status: invitation.status,
    email: invitation.email,
    expiresAt: invitation.expiresAt,
    link,
    whatsappUrl: membroInvitationWhatsappUrl(body.phone ?? '', organization.name, link),
    emailSent,
  };
}

export async function revokeMemberInvitation(
  invitations: Pick<OrgInvitationRepository, 'revoke'>,
  organizationId: string,
  invitationId: string,
): Promise<void> {
  if (!(await invitations.revoke(organizationId, invitationId))) {
    throw new OrgInvitationNotFoundError();
  }
}
