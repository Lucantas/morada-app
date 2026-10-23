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
  condos: Pick<CondoRepository, 'getById' | 'isOperational' | 'getOrganization'>;
  residentsFor: ResidentsFor;
  now: () => Date;
}

export type InvitationTarget =
  | { kind: 'condo'; condo: Condominium; resident: Resident | null }
  | { kind: 'org'; organization: { id: string; name: string } };

export interface UsableInvitation {
  invitation: Invitation;
  target: InvitationTarget;
}

async function operationalCondo(
  deps: UsableInvitationDeps,
  condominiumId: string,
): Promise<Condominium | null> {
  const condo = await deps.condos.getById(condominiumId);
  return condo && (await deps.condos.isOperational(condo.id)) ? condo : null;
}

async function activeResident(
  deps: UsableInvitationDeps,
  condominiumId: string,
  residentId: string,
): Promise<Resident | null> {
  const resident = await deps.residentsFor(condominiumId).getById(residentId);
  return resident?.active ? resident : null;
}

export async function invitationTarget(
  deps: UsableInvitationDeps,
  invitation: Invitation,
): Promise<InvitationTarget | null> {
  if (invitation.role === 'membro') {
    const organization = await deps.condos.getOrganization(invitation.organizationId);
    return organization ? { kind: 'org', organization } : null;
  }
  const resident =
    invitation.role === 'morador'
      ? await activeResident(deps, invitation.condominiumId, invitation.residentId)
      : null;
  if (invitation.role === 'morador' && !resident) return null;
  const condo = await operationalCondo(deps, invitation.condominiumId);
  return condo ? { kind: 'condo', condo, resident } : null;
}

export async function findUsableInvitation(
  deps: UsableInvitationDeps,
  token: string,
): Promise<UsableInvitation> {
  const invitation = await deps.invitations.findByTokenHash(hashToken(token), deps.now());
  if (invitation?.status !== 'pendente') throw new InvalidInvitationError();
  const target = await invitationTarget(deps, invitation);
  if (!target) throw new InvalidInvitationError();
  return { invitation, target };
}
