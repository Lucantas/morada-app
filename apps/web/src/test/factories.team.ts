import { InviteForm } from '@/features/invitations/ui/invite-form';
import { InviteShare } from '@/features/invitations/ui/invite-share';
import type { Team, TeamMember } from '@/features/team/domain/team';
import type { TeamRepository } from '@/features/team/domain/team-repository';
import type { CreatedInvitation } from '@/features/invitations/domain/invitation';

import { CREATED_INVITATION } from './factories.invitations';

export function buildTeamMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    userId: 'u2',
    name: 'Bruno Alves',
    email: 'bruno@exemplo.com',
    role: 'member',
    active: true,
    condoIds: ['c1'],
    ...overrides,
  };
}

export const TEAM: Team = {
  id: 'o1',
  name: 'Administradora Aurora',
  members: [
    buildTeamMember({
      userId: 'u1',
      name: 'Lúcia Dono',
      email: 'lucia@exemplo.com',
      role: 'owner',
      condoIds: [],
    }),
    buildTeamMember(),
    buildTeamMember({
      userId: 'u3',
      name: null,
      email: 'inativo@exemplo.com',
      active: false,
      condoIds: [],
    }),
  ],
  condos: [
    { id: 'c1', name: 'Condomínio Morada' },
    { id: 'c2', name: 'Edifício Sol' },
  ],
  invitations: [
    {
      id: 'i1',
      email: 'novo@exemplo.com',
      orgRole: 'member',
      expiresAt: '2026-10-30T15:00:00.000Z',
    },
  ],
};

type MockOf<F extends (...args: never[]) => unknown> = jest.Mock<ReturnType<F>, Parameters<F>>;

export type FakeTeamRepository = { [K in keyof TeamRepository]: MockOf<TeamRepository[K]> };

export function fakeTeamRepository(
  overrides: Partial<FakeTeamRepository> = {},
): FakeTeamRepository {
  const repository = {
    get: jest.fn<Promise<Team>, []>().mockResolvedValue(TEAM),
    rename: jest.fn<Promise<void>, [string]>().mockResolvedValue(),
    invite: jest
      .fn<Promise<CreatedInvitation>, Parameters<TeamRepository['invite']>>()
      .mockResolvedValue(CREATED_INVITATION),
    revokeInvitation: jest.fn<Promise<void>, [string]>().mockResolvedValue(),
    deactivateMember: jest.fn<Promise<void>, [string]>().mockResolvedValue(),
    assignCondos: jest.fn<Promise<void>, [string, readonly string[]]>().mockResolvedValue(),
  } satisfies FakeTeamRepository;
  return { ...repository, ...overrides };
}

export const INVITE_SLOTS = { inviteForm: InviteForm, inviteShare: InviteShare };
