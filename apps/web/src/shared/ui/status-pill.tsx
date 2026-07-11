export type PillTone = 'pago' | 'pendente' | 'atrasado' | 'info';

const TONES: Record<PillTone, { bg: string; fg: string; ln: string }> = {
  pago: { bg: 'var(--pago-bg)', fg: 'var(--pago-700)', ln: 'var(--pago-line)' },
  pendente: { bg: 'var(--pend-bg)', fg: 'var(--pend-700)', ln: 'var(--pend-line)' },
  atrasado: { bg: 'var(--atraso-bg)', fg: 'var(--atraso-700)', ln: 'var(--atraso-line)' },
  info: { bg: 'var(--info-bg)', fg: 'var(--info-700)', ln: 'var(--petrol-100)' },
};

export function StatusPill({
  tone,
  label,
  size = 'md',
}: {
  tone: PillTone;
  label: string;
  size?: 'sm' | 'md';
}) {
  const t = TONES[tone];
  const small = size === 'sm';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: small ? 6 : 7,
        fontWeight: 600,
        fontSize: small ? '.76rem' : '.82rem',
        padding: small ? '4px 10px 4px 9px' : '6px 12px 6px 10px',
        borderRadius: 999,
        border: `1px solid ${t.ln}`,
        background: t.bg,
        color: t.fg,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: small ? 7 : 8,
          height: small ? 7 : 8,
          borderRadius: '50%',
          background: t.fg,
        }}
      />
      {label}
    </span>
  );
}
