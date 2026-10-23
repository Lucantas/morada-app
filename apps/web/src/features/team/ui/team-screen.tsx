import { useState, type ComponentType, type ReactNode } from 'react';

import type { Validation } from '@/features/auth/domain/auth-schemas';
import { formatDayMonth, type CreatedInvitation } from '@/features/invitations/domain/invitation';
import { useCondoName } from '@/shared/lib/condo-scope';
import type { OrgRole } from '@/shared/lib/permissions';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { Icon } from '@/shared/ui/icon';
import { Field, PrimaryButton, SectionLabel, SurfaceCard } from '@/shared/ui/primitives';
import { StatusView } from '@/shared/ui/status-view';

import { TeamError } from '../domain/errors';
import { memberLabel, validateTeamEmail, type Team, type TeamMember } from '../domain/team';
import type { TeamRepository } from '../domain/team-repository';

import { TeamMembers } from './team-members';
import { useTeam, useTeamActions } from './use-team';

export type InviteFormSlot = ComponentType<{
  initialEmail: string;
  submitLabel: string;
  pending: boolean;
  error: string | null;
  onSubmit: (email: string, phone?: string) => void;
  emailLabel: string;
  description: string;
  validateEmail: (email: string) => Validation<string>;
  askPhone: boolean;
  extraFields: ReactNode;
}>;

export type InviteShareSlot = ComponentType<{ created: CreatedInvitation; recipient: string }>;

type Slots = { inviteForm: InviteFormSlot; inviteShare: InviteShareSlot };

type Props = Slots & {
  repository: TeamRepository;
  onBack: () => void;
};

const GENERIC_ERROR = 'Não foi possível concluir. Tente novamente.';

function errorMessage(error: unknown): string {
  return error instanceof TeamError ? error.message : GENERIC_ERROR;
}

export function TeamScreen({ repository, onBack, inviteForm, inviteShare }: Props) {
  const condoName = useCondoName();
  const team = useTeam(repository);

  return (
    <Screen>
      <Header condoName={condoName} onBack={onBack} />
      <ScreenBody>
        {team.isPending && <StatusView variant="loading" message="Carregando…" />}
        {team.isError && (
          <StatusView
            variant="error"
            message="Não foi possível carregar a equipe."
            onRetry={() => void team.refetch()}
          />
        )}
        {team.isSuccess && (
          <TeamPanel
            team={team.data}
            repository={repository}
            inviteForm={inviteForm}
            inviteShare={inviteShare}
          />
        )}
      </ScreenBody>
    </Screen>
  );
}

function TeamPanel({
  team,
  repository,
  inviteForm: InviteForm,
  inviteShare: InviteShare,
}: Slots & { team: Team; repository: TeamRepository }) {
  const actions = useTeamActions(repository);
  const [created, setCreated] = useState<CreatedInvitation | null>(null);
  const [orgRole, setOrgRole] = useState<OrgRole>('member');
  const [confirming, setConfirming] = useState<TeamMember | null>(null);

  const failure =
    actions.rename.error ??
    actions.revoke.error ??
    actions.deactivate.error ??
    actions.assignCondos.error;

  return (
    <>
      <OrganizationName
        name={team.name}
        saving={actions.rename.isPending}
        onSave={(name) => actions.rename.mutate(name)}
      />
      <SectionLabel>Convidar para a equipe</SectionLabel>
      {created ? (
        <>
          <InviteShare created={created} recipient="convidado" />
          <LinkButton onClick={() => setCreated(null)}>Convidar outra pessoa</LinkButton>
        </>
      ) : (
        <InviteForm
          emailLabel="E-mail da pessoa"
          description="A pessoa recebe um link para criar a própria senha e entrar na equipe."
          validateEmail={validateTeamEmail}
          askPhone
          initialEmail=""
          submitLabel="Gerar convite"
          pending={actions.invite.isPending}
          error={actions.invite.isError ? errorMessage(actions.invite.error) : null}
          extraFields={<RoleSelect value={orgRole} onChange={setOrgRole} />}
          onSubmit={(email, phone) =>
            actions.invite.mutate({ email, orgRole, phone }, { onSuccess: setCreated })
          }
        />
      )}
      {team.invitations.length > 0 && (
        <>
          <SectionLabel>Convites pendentes</SectionLabel>
          <ul
            style={{ listStyle: 'none', margin: '0 0 16px', padding: 0, display: 'grid', gap: 12 }}
          >
            {team.invitations.map((invitation) => (
              <li key={invitation.id}>
                <SurfaceCard>
                  <p style={{ fontWeight: 600, margin: 0 }}>{invitation.email}</p>
                  <p style={{ color: 'var(--ink-500)', fontSize: '.86rem', margin: '4px 0 8px' }}>
                    {`${invitation.orgRole === 'owner' ? 'Dono' : 'Membro'} · vence em ${formatDayMonth(invitation.expiresAt)}`}
                  </p>
                  <LinkButton
                    onClick={() => actions.revoke.mutate(invitation.id)}
                    disabled={actions.revoke.isPending}
                  >
                    Revogar
                  </LinkButton>
                </SurfaceCard>
              </li>
            ))}
          </ul>
        </>
      )}
      <SectionLabel>Membros</SectionLabel>
      <TeamMembers
        team={team}
        busyUserId={
          actions.assignCondos.isPending ? (actions.assignCondos.variables?.userId ?? null) : null
        }
        onAssign={(userId, condoIds) => actions.assignCondos.mutate({ userId, condoIds })}
        onDeactivate={setConfirming}
      />
      {failure && (
        <p role="alert" style={{ color: 'var(--atraso-700)', margin: '14px 0 0' }}>
          {errorMessage(failure)}
        </p>
      )}
      <ConfirmDialog
        open={confirming !== null}
        title={confirming ? `Desativar ${memberLabel(confirming)}?` : ''}
        message="A pessoa perde o acesso a todos os condomínios da organização."
        confirmLabel="Desativar membro"
        tone="danger"
        isPending={actions.deactivate.isPending}
        onConfirm={() => {
          if (confirming) actions.deactivate.mutate(confirming.userId);
          setConfirming(null);
        }}
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}

function OrganizationName({
  name,
  saving,
  onSave,
}: {
  name: string;
  saving: boolean;
  onSave: (name: string) => void;
}) {
  const [draft, setDraft] = useState(name);
  const trimmed = draft.trim();
  return (
    <div style={{ marginBottom: 8 }}>
      <Field label="Nome da organização" value={draft} onChange={setDraft} />
      <PrimaryButton
        icon="check"
        onClick={() => onSave(trimmed)}
        disabled={saving || trimmed === '' || trimmed === name}
      >
        {saving ? 'Salvando…' : 'Salvar'}
      </PrimaryButton>
      <div style={{ height: 20 }} />
    </div>
  );
}

function RoleSelect({ value, onChange }: { value: OrgRole; onChange: (role: OrgRole) => void }) {
  return (
    <label style={{ display: 'block', marginBottom: 16 }}>
      <span style={{ display: 'block', fontWeight: 600, fontSize: '.9rem', marginBottom: 7 }}>
        Papel
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value === 'owner' ? 'owner' : 'member')}
        style={{
          width: '100%',
          minHeight: 50,
          border: '1.5px solid var(--line)',
          borderRadius: 'var(--r-md)',
          padding: '0 15px',
          fontFamily: "'Inter', sans-serif",
          fontSize: '1rem',
          background: 'var(--surface)',
        }}
      >
        <option value="member">Membro</option>
        <option value="owner">Dono</option>
      </select>
    </label>
  );
}

function LinkButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: 44,
        padding: '0 4px',
        marginTop: 8,
        background: 'none',
        border: 'none',
        color: 'var(--petrol-800)',
        fontFamily: "'Inter', sans-serif",
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function Header({ condoName, onBack }: { condoName: string; onBack: () => void }) {
  return (
    <div
      style={{
        background: 'var(--petrol-800)',
        color: '#fff',
        padding: '18px 18px 20px',
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <button
        onClick={onBack}
        aria-label="Voltar"
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          background: 'rgba(255,255,255,.12)',
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          border: 'none',
          flex: 'none',
        }}
      >
        <Icon name="chevronLeft" color="#fff" />
      </button>
      <div>
        <div style={{ fontSize: '.78rem', color: '#A9C6C9', fontWeight: 500 }}>{condoName}</div>
        <h1 className="fraunces" style={{ margin: 0, fontSize: '1.35rem', fontWeight: 600 }}>
          Equipe
        </h1>
      </div>
    </div>
  );
}
