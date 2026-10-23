import type { CondoRepository } from '../../condos/domain/condo-repository';
import type { EmailSender } from '../../platform/email/email-sender';
import { generateToken, hashToken } from '../../platform/tokens';
import type { ResidentRepository } from '../../residents/domain/resident-repository';
import { normalizeEmail, emailSchema } from '../../users/domain/email';
import { invitationLink, invitationMessage } from '../../users/app/emails';
import { InvitationCondoNotFoundError, InvitationResidentNotFoundError } from '../domain/errors';
import { invitationExpiry, type InvitationStatus } from '../domain/invitation';
import type { CondoInvitationRepository } from '../domain/invitation-repository';
import { invitationWhatsappUrl } from '../domain/whatsapp';

export interface CreateInvitationDeps {
  invitations: CondoInvitationRepository;
  residents: ResidentRepository;
  condos: CondoRepository;
  email: EmailSender;
  appUrl: string;
  now: () => Date;
}

export interface CreatedInvitation {
  status: InvitationStatus;
  email: string | null;
  expiresAt: Date;
  link: string;
  whatsappUrl: string;
}

function resolveEmail(requested: string | undefined, stored: string): string | null {
  const candidate = requested === undefined ? stored : requested;
  const parsed = emailSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;
  if (requested !== undefined && normalizeEmail(requested) !== '') {
    throw parsed.error;
  }
  return null;
}

export async function createInvitation(
  deps: CreateInvitationDeps,
  condominiumId: string,
  residentId: string,
  createdBy: string,
  requestedEmail: string | undefined,
): Promise<CreatedInvitation> {
  const resident = await deps.residents.getById(residentId);
  if (!resident) throw new InvitationResidentNotFoundError(residentId);
  const condo = await deps.condos.getById(condominiumId);
  if (!condo) throw new InvitationCondoNotFoundError();
  const email = resolveEmail(requestedEmail, resident.email);

  const now = deps.now();
  const token = generateToken();
  const invitation = await deps.invitations.create(
    { residentId, email, tokenHash: hashToken(token), expiresAt: invitationExpiry(now), createdBy },
    now,
  );
  const link = invitationLink(deps.appUrl, token);
  if (email !== null) await deps.email.send(invitationMessage(email, condo.name, link));

  return {
    status: invitation.status,
    email: invitation.email,
    expiresAt: invitation.expiresAt,
    link,
    whatsappUrl: invitationWhatsappUrl(resident.phone, resident.name, condo.name, link),
  };
}
