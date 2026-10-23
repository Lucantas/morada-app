import type { CondoGrant, CondoRepository } from '../condos/domain/condo-repository';
import type { Condominium } from '../condos/domain/condominium';
import { effectiveStatus, type Invitation } from '../invitations/domain/invitation';
import type { InvitationTokenRepository } from '../invitations/domain/invitation-repository';
import type { Resident } from '../residents/domain/resident';

interface StoredInvitation {
  invitation: Invitation;
  tokenHash: string;
}

const stored = (invitation: Invitation) =>
  invitation.status === 'expirado' ? 'pendente' : invitation.status;

export function inMemoryInvitationTokens(
  initial: StoredInvitation[] = [],
): InvitationTokenRepository & { byId: (id: string) => Invitation | undefined } {
  let rows = [...initial];
  const derive = (invitation: Invitation, now: Date): Invitation => ({
    ...invitation,
    status: effectiveStatus(stored(invitation), invitation.expiresAt, now),
  });
  const update = (id: string, change: (invitation: Invitation) => Invitation | null): boolean => {
    const row = rows.find((r) => r.invitation.id === id);
    const changed = row ? change(row.invitation) : null;
    if (!row || !changed) return false;
    rows = rows.map((r) => (r === row ? { ...r, invitation: changed } : r));
    return true;
  };
  return {
    byId: (id) => rows.find((r) => r.invitation.id === id)?.invitation,
    findByTokenHash: async (hash, now = new Date()) => {
      const row = rows.find((r) => r.tokenHash === hash);
      return row ? derive(row.invitation, now) : null;
    },
    claim: async (id, userId) =>
      update(id, (i) =>
        i.claimedBy === null && stored(i) === 'pendente' ? { ...i, claimedBy: userId } : null,
      ),
    accept: async (id, at) =>
      update(id, (i) =>
        stored(i) === 'pendente' ? { ...i, status: 'aceito', acceptedAt: at } : null,
      ),
    claimedBy: async (userId, now = new Date()) =>
      rows
        .map((r) => r.invitation)
        .filter((i) => i.claimedBy === userId && stored(i) === 'pendente')
        .map((i) => derive(i, now)),
  };
}

export type FakeCondos = Pick<CondoRepository, 'getById' | 'grant' | 'deactivateResidentGrants'> & {
  grants: () => CondoGrant[];
  deactivations: () => { condominiumId: string; residentId: string; exceptUserId: string }[];
};

export function fakeCondos(condos: Condominium[]): FakeCondos {
  let grants: CondoGrant[] = [];
  let deactivations: { condominiumId: string; residentId: string; exceptUserId: string }[] = [];
  return {
    grants: () => grants,
    deactivations: () => deactivations,
    getById: async (id) => condos.find((c) => c.id === id) ?? null,
    grant: async (grant) => {
      grants = [...grants, grant];
    },
    deactivateResidentGrants: async (condominiumId, residentId, exceptUserId) => {
      deactivations = [...deactivations, { condominiumId, residentId, exceptUserId }];
    },
  };
}

export function fakeResidentsFor(
  residents: Record<string, Resident[]>,
): (condominiumId: string) => { getById: (id: string) => Promise<Resident | null> } {
  return (condominiumId) => ({
    getById: async (id) => residents[condominiumId]?.find((r) => r.id === id) ?? null,
  });
}

export const INVITE_NOW = new Date('2026-10-23T12:00:00.000Z');

export function invitationFixture(overrides: Partial<Invitation> = {}): Invitation {
  return {
    id: 'inv-1',
    condominiumId: 'condo-a',
    residentId: 'r-1',
    role: 'morador',
    email: 'maria@x.com',
    status: 'pendente',
    expiresAt: new Date(INVITE_NOW.getTime() + 60_000),
    createdBy: 'u-admin',
    claimedBy: null,
    acceptedAt: null,
    createdAt: INVITE_NOW,
    ...overrides,
  };
}

export function residentFixture(overrides: Partial<Resident> = {}): Resident {
  return {
    id: 'r-1',
    name: 'Maria Ribeiro',
    apt: 'Apto 302',
    apartmentId: 'apt-r-1',
    phone: '(11) 90000-0001',
    email: 'maria@x.com',
    status: 'em_dia',
    active: true,
    ...overrides,
  };
}

export const CONDO_A: Condominium = {
  id: 'condo-a',
  organizationId: 'org-a',
  name: 'Morada Bloco 2',
  active: true,
};
