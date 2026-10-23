import { SurfaceCard } from '@/shared/ui/primitives';

import { memberLabel, toggleCondo, type Team, type TeamMember } from '../domain/team';

type Props = {
  team: Team;
  busyUserId: string | null;
  onAssign: (userId: string, condoIds: readonly string[]) => void;
  onDeactivate: (member: TeamMember) => void;
};

const mutedStyle = { color: 'var(--ink-500)', fontSize: '.86rem', margin: '4px 0 0' } as const;

export function TeamMembers({ team, busyUserId, onAssign, onDeactivate }: Props) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
      {team.members.map((member) => (
        <li key={member.userId}>
          <SurfaceCard>
            <p style={{ fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
              {memberLabel(member)}
            </p>
            {member.name && member.email && <p style={mutedStyle}>{member.email}</p>}
            <MemberBody
              team={team}
              member={member}
              busy={busyUserId === member.userId}
              onAssign={onAssign}
              onDeactivate={onDeactivate}
            />
          </SurfaceCard>
        </li>
      ))}
    </ul>
  );
}

function MemberBody({
  team,
  member,
  busy,
  onAssign,
  onDeactivate,
}: {
  team: Team;
  member: TeamMember;
  busy: boolean;
  onAssign: Props['onAssign'];
  onDeactivate: Props['onDeactivate'];
}) {
  if (member.role === 'owner') {
    return <p style={mutedStyle}>Dono · vê todos os condomínios</p>;
  }
  if (!member.active) return <p style={mutedStyle}>Desativado</p>;
  return (
    <>
      <p style={mutedStyle}>Membro</p>
      <fieldset style={{ border: 'none', margin: '12px 0 0', padding: 0 }} disabled={busy}>
        <legend style={{ fontWeight: 600, fontSize: '.9rem', padding: 0, marginBottom: 6 }}>
          Administra
        </legend>
        {team.condos.map((condo) => (
          <label
            key={condo.id}
            style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40 }}
          >
            <input
              type="checkbox"
              checked={member.condoIds.includes(condo.id)}
              onChange={() =>
                onAssign(member.userId, toggleCondo(team.condos, member.condoIds, condo.id))
              }
            />
            <span>{condo.name}</span>
          </label>
        ))}
      </fieldset>
      <button
        type="button"
        onClick={() => onDeactivate(member)}
        style={{
          marginTop: 10,
          minHeight: 44,
          padding: '0 16px',
          borderRadius: 'var(--r-md)',
          border: '1.5px solid var(--atraso-700)',
          background: 'var(--surface)',
          color: 'var(--atraso-700)',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Desativar
      </button>
    </>
  );
}
