import { z } from 'zod';

import type { CondoRepository } from '../../condos/domain/condo-repository';
import type { EmailSender } from '../../platform/email/email-sender';
import { generateToken, hashToken } from '../../platform/tokens';
import { invitationLink, sindicoInvitationMessage } from '../../users/app/emails';
import { emailSchema } from '../../users/domain/email';
import { InvitationCondoNotFoundError } from '../domain/errors';
import { invitationExpiry } from '../domain/invitation';
import type { CondoInvitationRepository } from '../domain/invitation-repository';
import { sindicoInvitationWhatsappUrl } from '../domain/whatsapp';

import { trySend, type CreatedInvitation } from './create-invitation';

const createSindicoBodySchema = z.object({
  email: emailSchema,
  phone: z.string().max(40).optional(),
});

export interface CreateSindicoInvitationDeps {
  invitations: CondoInvitationRepository;
  condos: Pick<CondoRepository, 'getById'>;
  email: EmailSender;
  appUrl: string;
  now: () => Date;
}

export async function createSindicoInvitation(
  deps: CreateSindicoInvitationDeps,
  condominiumId: string,
  createdBy: string,
  input: unknown,
): Promise<CreatedInvitation> {
  const body = createSindicoBodySchema.parse(input);
  const condo = await deps.condos.getById(condominiumId);
  if (!condo) throw new InvitationCondoNotFoundError();

  const now = deps.now();
  const token = generateToken();
  const invitation = await deps.invitations.createSindico(
    { email: body.email, tokenHash: hashToken(token), expiresAt: invitationExpiry(now), createdBy },
    now,
  );
  const link = invitationLink(deps.appUrl, token);
  const emailSent = await trySend(
    deps.email,
    sindicoInvitationMessage(invitation.email, condo.name, link),
  );

  return {
    status: invitation.status,
    email: invitation.email,
    expiresAt: invitation.expiresAt,
    link,
    whatsappUrl: sindicoInvitationWhatsappUrl(body.phone ?? '', condo.name, link),
    emailSent,
  };
}
