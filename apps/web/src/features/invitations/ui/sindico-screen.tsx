import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCondoName } from '@/shared/lib/condo-scope';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { Icon } from '@/shared/ui/icon';
import { PrimaryButton, SurfaceCard } from '@/shared/ui/primitives';
import { StatusView } from '@/shared/ui/status-view';

import {
  formatDayMonth,
  validateSindicoEmail,
  type CreatedInvitation,
  type InvitationView,
  type SindicoView,
} from '../domain/invitation';
import type { InvitationRepository } from '../domain/invitation-repository';

import { InviteForm } from './invite-form';
import { InviteShare } from './invite-share';
import { invitationErrorMessage } from './invitation-error-message';

type Repository = Pick<
  InvitationRepository,
  'sindico' | 'inviteSindico' | 'revokeSindico' | 'removeSindico'
>;

type Props = {
  repository: Repository;
  onBack: () => void;
};

const SINDICO_KEY = ['sindico'] as const;

const FORM_COPY = {
  emailLabel: 'E-mail do síndico',
  description: 'O síndico recebe um link por e-mail para criar a própria senha.',
  validateEmail: validateSindicoEmail,
  askPhone: true,
} as const;

const NOT_FOUND_MESSAGE = 'Síndico não encontrado.';

export function SindicoScreen({ repository, onBack }: Props) {
  const condoName = useCondoName();
  const sindico = useQuery({ queryKey: SINDICO_KEY, queryFn: () => repository.sindico() });

  return (
    <Screen>
      <Header condoName={condoName} onBack={onBack} />
      <ScreenBody>
        {sindico.isPending && <StatusView variant="loading" message="Carregando…" />}
        {sindico.isError && (
          <StatusView
            variant="error"
            message="Não foi possível carregar o síndico."
            onRetry={() => void sindico.refetch()}
          />
        )}
        {sindico.isSuccess && <SindicoPanel view={sindico.data} repository={repository} />}
      </ScreenBody>
    </Screen>
  );
}

function SindicoPanel({ view, repository }: { view: SindicoView; repository: Repository }) {
  const queryClient = useQueryClient();
  const [created, setCreated] = useState<CreatedInvitation | null>(null);
  const [confirming, setConfirming] = useState<'remove' | 'revoke' | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: SINDICO_KEY });
  const invite = useMutation({
    mutationFn: ({ email, phone }: { email: string; phone?: string }) =>
      repository.inviteSindico(email, phone),
    onSuccess: (result) => {
      setCreated(result);
      void refresh();
    },
  });
  const revoke = useMutation({
    mutationFn: () => repository.revokeSindico(),
    onSuccess: () => {
      void refresh();
    },
    onSettled: () => setConfirming(null),
  });
  const remove = useMutation({
    mutationFn: () => repository.removeSindico(),
    onSuccess: () => {
      void refresh();
    },
    onSettled: () => setConfirming(null),
  });

  if (created) return <InviteShare created={created} recipient="síndico" />;

  const actionError = invite.isError
    ? invitationErrorMessage(invite.error)
    : revoke.isError
      ? invitationErrorMessage(revoke.error)
      : remove.isError
        ? invitationErrorMessage(remove.error, { 'not-found': NOT_FOUND_MESSAGE })
        : null;
  const pending = view.invitation?.status === 'pendente' ? view.invitation : null;
  const lapsed =
    view.invitation?.status === 'expirado' || view.invitation?.status === 'revogado'
      ? view.invitation
      : null;

  return (
    <>
      {view.current && (
        <CurrentSindico
          name={view.current.name}
          email={view.current.email}
          onRemove={() => setConfirming('remove')}
        />
      )}
      {pending ? (
        <PendingInvite
          invitation={pending}
          resending={invite.isPending}
          onResend={() => invite.mutate({ email: pending.email ?? '' })}
          onRevoke={() => setConfirming('revoke')}
        />
      ) : (
        <>
          {lapsed && (
            <StateCard
              title={lapsed.status === 'expirado' ? 'Convite expirado' : 'Convite revogado'}
            />
          )}
          <InviteForm
            {...FORM_COPY}
            initialEmail={lapsed?.email ?? ''}
            submitLabel={lapsed ? 'Gerar novo convite' : 'Gerar convite'}
            pending={invite.isPending}
            error={null}
            onSubmit={(email, phone) => invite.mutate({ email, phone })}
          />
        </>
      )}
      {actionError && (
        <p role="alert" style={{ color: 'var(--atraso-700)', margin: '14px 0 0' }}>
          {actionError}
        </p>
      )}
      <ConfirmDialog
        open={confirming === 'remove'}
        title="Remover síndico?"
        message="Ele perde o acesso de síndico a este condomínio."
        confirmLabel="Remover síndico"
        tone="danger"
        isPending={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={confirming === 'revoke'}
        title="Revogar convite?"
        message="O link enviado deixa de funcionar."
        confirmLabel="Revogar convite"
        tone="danger"
        isPending={revoke.isPending}
        onConfirm={() => revoke.mutate()}
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}

function CurrentSindico({
  name,
  email,
  onRemove,
}: {
  name: string | null;
  email: string | null;
  onRemove: () => void;
}) {
  return (
    <>
      <StateCard
        title={name ?? email ?? 'Síndico'}
        detail={name ? (email ?? undefined) : undefined}
      />
      <button type="button" onClick={onRemove} style={dangerButtonStyle}>
        Remover síndico
      </button>
      <div style={{ height: 20 }} />
    </>
  );
}

function PendingInvite({
  invitation,
  resending,
  onResend,
  onRevoke,
}: {
  invitation: InvitationView;
  resending: boolean;
  onResend: () => void;
  onRevoke: () => void;
}) {
  return (
    <>
      <StateCard
        title={`Convite pendente · vence em ${formatDayMonth(invitation.expiresAt)}`}
        detail={invitation.email ? `Convite para ${invitation.email}` : undefined}
        note="Se o link foi repassado para outra pessoa, gere um novo convite."
      />
      <PrimaryButton icon="message" onClick={onResend} disabled={resending}>
        {resending ? 'Gerando…' : 'Reenviar'}
      </PrimaryButton>
      <button type="button" onClick={onRevoke} style={dangerButtonStyle}>
        Revogar
      </button>
    </>
  );
}

function StateCard({ title, detail, note }: { title: string; detail?: string; note?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <SurfaceCard>
        <p style={{ fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>{title}</p>
        {detail && (
          <p style={{ color: 'var(--ink-500)', fontSize: '.9rem', margin: '6px 0 0' }}>{detail}</p>
        )}
        {note && (
          <p style={{ color: 'var(--ink-700)', fontSize: '.88rem', margin: '10px 0 0' }}>{note}</p>
        )}
      </SurfaceCard>
    </div>
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
          Síndico
        </h1>
      </div>
    </div>
  );
}

const dangerButtonStyle = {
  width: '100%',
  minHeight: 50,
  marginTop: 12,
  borderRadius: 'var(--r-md)',
  border: '1.5px solid var(--atraso-700)',
  background: 'var(--surface)',
  color: 'var(--atraso-700)',
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '1rem',
  cursor: 'pointer',
} as const;
