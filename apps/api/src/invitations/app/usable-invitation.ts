import type { CondoRepository } from '../../condos/domain/condo-repository';
import type { Condominium } from '../../condos/domain/condominium';
import { hashToken } from '../../platform/tokens';
import type { Resident } from '../../residents/domain/resident';
import type { ResidentRepository } from '../../residents/domain/resident-repository';
import { InvalidInvitationError } from '../domain/errors';
import type { Invitation } from '../domain/invitation';
import type { InvitationTokenRepository } from '../domain/invitation-repository';

export type ResidentsFor = (condominiumId: string) => Pick<ResidentRepository, 'getById'>;

export interface UsableInvitationDeps {
  invitations: InvitationTokenRepository;
  condos: Pick<CondoRepository, 'getById' | 'isOperational'>;
  residentsFor: ResidentsFor;
  now: () => Date;
}

export interface UsableInvitation {
  invitation: Invitation;
  resident: Resident;
  condo: Condominium;
}

export async function findUsableInvitation(
  deps: UsableInvitationDeps,
  token: string,
): Promise<UsableInvitation> {
  const invitation = await deps.invitations.findByTokenHash(hashToken(token), deps.now());
  if (invitation?.status !== 'pendente') throw new InvalidInvitationError();
  const resident = await deps.residentsFor(invitation.condominiumId).getById(invitation.residentId);
  if (!resident?.active) throw new InvalidInvitationError();
  const condo = await deps.condos.getById(invitation.condominiumId);
  if (!condo || !(await deps.condos.isOperational(condo.id))) throw new InvalidInvitationError();
  return { invitation, resident, condo };
}
