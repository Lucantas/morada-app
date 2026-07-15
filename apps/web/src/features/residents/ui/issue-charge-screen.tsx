import { useState } from 'react';

import { Icon } from '@/shared/ui/icon';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { Field, PrimaryButton, SurfaceCard } from '@/shared/ui/primitives';
import { MoneyInput } from '@/shared/ui/money-input';

type ChargeInput = {
  residentId: string;
  ref: string;
  title: string;
  valueCents: number;
  dueDate: string;
};

type Props = {
  residentId: string;
  residentName?: string;
  issue: (input: ChargeInput) => Promise<void>;
  onBack: () => void;
};

const TITLE = 'Taxa condominial';

export function IssueChargeScreen({ residentId, residentName, issue, onBack }: Props) {
  const [ref, setRef] = useState('');
  const [valueCents, setValueCents] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!ref.trim() || !dueDate || valueCents <= 0) {
      setError('Preencha referência, valor e vencimento.');
      return;
    }
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await issue({ residentId, ref: ref.trim(), title: TITLE, valueCents, dueDate });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível adicionar o recibo.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Screen>
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '.78rem', color: '#A9C6C9', fontWeight: 500 }}>
            Adicionar recibo · Bloco 2
          </div>
          <div className="fraunces" style={{ fontSize: '1.35rem', fontWeight: 600, color: '#fff' }}>
            {residentName ?? 'Novo recibo'}
          </div>
        </div>
      </div>
      <ScreenBody>
        {done ? (
          <SurfaceCard>
            <p style={{ fontWeight: 600, color: 'var(--ink-900)' }}>
              Recibo adicionado. O morador já o vê como pendente em “Meus recibos”.
            </p>
          </SurfaceCard>
        ) : (
          <div style={{ paddingTop: 2 }}>
            <Field label="Referência" value={ref} onChange={setRef} placeholder="Ex.: 05/2026" />
            <MoneyInput label="Valor" value={valueCents} onChange={setValueCents} />
            <Field label="Vencimento" value={dueDate} onChange={setDueDate} type="date" />
            {error && (
              <p role="alert" style={{ color: 'var(--atraso-700)', marginBottom: 14 }}>
                {error}
              </p>
            )}
            <PrimaryButton icon="receipt" onClick={() => void submit()}>
              {pending ? 'Adicionando…' : 'Adicionar'}
            </PrimaryButton>
          </div>
        )}
      </ScreenBody>
    </Screen>
  );
}
