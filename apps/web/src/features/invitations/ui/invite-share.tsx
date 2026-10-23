import { PrimaryButton, SurfaceCard } from '@/shared/ui/primitives';

import { formatDayMonth, type CreatedInvitation } from '../domain/invitation';

import { CopyButton } from './copy-button';

export function InviteShare({ created }: { created: CreatedInvitation }) {
  return (
    <div>
      <SurfaceCard>
        <p style={{ fontWeight: 600, color: 'var(--ink-900)', margin: '0 0 8px' }}>
          {`Convite criado · vence em ${formatDayMonth(created.expiresAt)}`}
        </p>
        <p style={{ color: 'var(--ink-500)', fontSize: '.86rem', margin: '0 0 10px' }}>
          O link vale para uma pessoa só. Envie apenas para o morador.
        </p>
        <div
          data-testid="invite-link"
          style={{
            fontSize: '.86rem',
            color: 'var(--ink-900)',
            wordBreak: 'break-all',
            background: 'var(--petrol-50)',
            borderRadius: 'var(--r-sm)',
            padding: '10px 12px',
            marginBottom: 12,
          }}
        >
          {created.link}
        </div>
        <CopyButton value={created.link} label="Copiar link" copiedLabel="Link copiado!" />
      </SurfaceCard>
      <div style={{ marginTop: 16 }}>
        <PrimaryButton
          icon="message"
          onClick={() => window.open(created.whatsappUrl, '_blank', 'noopener')}
        >
          Enviar pelo WhatsApp
        </PrimaryButton>
      </div>
      {created.email && (
        <div
          role="status"
          style={{
            marginTop: 14,
            padding: '12px 14px',
            borderRadius: 'var(--r-md)',
            background: created.emailSent ? 'var(--pago-bg)' : 'var(--atraso-bg)',
            border: `1px solid ${created.emailSent ? 'var(--pago-line)' : 'var(--atraso-line)'}`,
            color: created.emailSent ? 'var(--pago-700)' : 'var(--atraso-700)',
          }}
        >
          <strong style={{ display: 'block', marginBottom: 2 }}>Enviar por e-mail</strong>
          <span style={{ fontSize: '.92rem' }}>
            {created.emailSent
              ? `E-mail enviado para ${created.email}`
              : 'Não foi possível enviar o e-mail agora. Envie pelo WhatsApp ou copie o link.'}
          </span>
        </div>
      )}
    </div>
  );
}
