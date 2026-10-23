import type { CreatedInvitation } from '@/features/invitations/domain/invitation';
import type { OrgRole } from '@/shared/lib/permissions';

import { TeamError } from '../domain/errors';
import type { Team, TeamMember } from '../domain/team';
import type { TeamRepository } from '../domain/team-repository';

const EXPIRES_AT = '2099-01-01T00:00:00.000Z';

export class InMemoryTeamRepository implements TeamRepository {
  private team: Team;

  constructor(seed: Team) {
    this.team = seed;
  }

  async get(): Promise<Team> {
    return this.team;
  }

  async rename(name: string): Promise<void> {
    this.team = { ...this.team, name };
  }

  async invite(email: string, orgRole: OrgRole): Promise<CreatedInvitation> {
    const id = `inv-${this.team.invitations.length + 1}`;
    this.team = {
      ...this.team,
      invitations: [
        ...this.team.invitations.filter((invitation) => invitation.email !== email),
        { id, email, orgRole, expiresAt: EXPIRES_AT },
      ],
    };
    return {
      status: 'pendente',
      email,
      expiresAt: EXPIRES_AT,
      link: `https://morada.app/#/convite/${id}`,
      whatsappUrl: `https://wa.me/?text=${id}`,
      emailSent: true,
    };
  }

  async revokeInvitation(invitationId: string): Promise<void> {
    this.team = {
      ...this.team,
      invitations: this.team.invitations.filter((invitation) => invitation.id !== invitationId),
    };
  }

  async deactivateMember(userId: string): Promise<void> {
    const member = this.find(userId);
    if (member.role === 'owner') throw new TeamError('Não é possível desativar um dono');
    this.replace({ ...member, active: false });
  }

  async assignCondos(userId: string, condoIds: readonly string[]): Promise<void> {
    this.replace({ ...this.find(userId), condoIds: [...condoIds] });
  }

  private find(userId: string): TeamMember {
    const member = this.team.members.find((candidate) => candidate.userId === userId);
    if (!member) throw new TeamError('Membro não encontrado');
    return member;
  }

  private replace(next: TeamMember): void {
    this.team = {
      ...this.team,
      members: this.team.members.map((member) => (member.userId === next.userId ? next : member)),
    };
  }
}
