import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { PrimaryButton, SurfaceCard } from '@/shared/ui/primitives';

import { formatDayMonth, type CreatedInvitation, type InvitationView } from '../domain/invitation';
import type { InvitationRepository } from '../domain/invitation-repository';

import { InviteForm } from './invite-form';
import { InviteShare } from './invite-share';
import { invitationErrorMessage } from './invitation-error-message';

export const invitationKey = (residentId: string) => ['invitation', residentId] as const;

export function InvitationPanel({
  residentId,
  residentEmail,
  view,
  repository,
}: {
  residentId: string;
  residentEmail: string;
  view: InvitationView | null;
  repository: Pick<InvitationRepository, 'invite' | 'revoke'>;
}) {
  const queryClient = useQueryClient();
  const [created, setCreated] = useState<CreatedInvitation | null>(null);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: invitationKey(residentId) });
  const invite = useMutation({
    mutationFn: (email: string) => repository.invite(residentId, email),
    onSuccess: (result) => {
      setCreated(result);
      void refresh();
    },
  });
  const revoke = useMutation({
    mutationFn: () => repository.revoke(residentId),
    onSuccess: () => {
      void refresh();
    },
    onSettled: () => setConfirmingRevoke(false),
  });

  if (created) return <InviteShare created={created} />;

  const inviteError = invite.isError ? invitationErrorMessage(invite.error) : null;

  if (view === null) {
    return (
      <InviteForm
        initialEmail={residentEmail}
        submitLabel="Gerar convite"
        pending={invite.isPending}
        error={inviteError}
        onSubmit={(email) => invite.mutate(email)}
      />
    );
  }

  if (view.status === 'aceito') {
    return <StateCard title="Acesso ativo por e-mail" detail={view.email ?? undefined} />;
  }

  if (view.status === 'expirado' || view.status === 'revogado') {
    return (
      <>
        <StateCard title={view.status === 'expirado' ? 'Convite expirado' : 'Convite revogado'} />
        <InviteForm
          initialEmail={view.email ?? residentEmail}
          submitLabel="Gerar novo convite"
          pending={invite.isPending}
          error={inviteError}
          onSubmit={(email) => invite.mutate(email)}
        />
      </>
    );
  }

  return (
    <>
      <StateCard
        title={`Convite pendente · vence em ${formatDayMonth(view.expiresAt)}`}
        detail={view.email ? `Convite para ${view.email}` : 'Convite por link'}
        note="Se o link foi repassado para outra pessoa, gere um novo convite."
      />
      {(inviteError || revoke.isError) && (
        <p role="alert" style={{ color: 'var(--atraso-700)', margin: '0 0 14px' }}>
          {inviteError ?? invitationErrorMessage(revoke.error)}
        </p>
      )}
      <PrimaryButton
        icon="message"
        onClick={() => invite.mutate(view.email ?? '')}
        disabled={invite.isPending}
      >
        {invite.isPending ? 'Gerando…' : 'Reenviar'}
      </PrimaryButton>
      <button type="button" onClick={() => setConfirmingRevoke(true)} style={secondaryButtonStyle}>
        Revogar
      </button>
      <ConfirmDialog
        open={confirmingRevoke}
        title="Revogar convite?"
        message="O link enviado deixa de funcionar."
        confirmLabel="Revogar convite"
        tone="danger"
        isPending={revoke.isPending}
        onConfirm={() => revoke.mutate()}
        onCancel={() => setConfirmingRevoke(false)}
      />
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

const secondaryButtonStyle = {
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
