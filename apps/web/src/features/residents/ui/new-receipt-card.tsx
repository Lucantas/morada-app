import { useState, type ChangeEvent } from 'react';

import { dueDateFromRef } from '@/features/receipts/domain/due-date';
import { fileToDataUrl, isAllowedProof } from '@/features/receipts/domain/proof';
import type { ReceiptMethod } from '@/features/receipts/domain/receipt';
import { maskCompetence } from '@/shared/lib/competence';
import { Icon } from '@/shared/ui/icon';
import { MoneyInput } from '@/shared/ui/money-input';

type IssueInput = {
  ref: string;
  valueCents: number;
  dueDate: string;
  paidAt?: string;
  method?: ReceiptMethod;
  proofDataUrl?: string;
};

type Props = {
  dueDay: number;
  issue: (input: IssueInput) => Promise<void>;
  onClose: () => void;
  defaultValueCents?: number;
};

const METHODS: { value: ReceiptMethod; label: string }[] = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
];

const STATUSES: { paid: boolean; label: string }[] = [
  { paid: false, label: 'Pendente' },
  { paid: true, label: 'Pago' },
];

export function NewReceiptCard({ dueDay, issue, onClose, defaultValueCents }: Props) {
  const [ref, setRef] = useState('');
  const [valueCents, setValueCents] = useState(defaultValueCents ?? 0);
  const [paid, setPaid] = useState(false);
  const [method, setMethod] = useState<ReceiptMethod>('dinheiro');
  const [proofDataUrl, setProofDataUrl] = useState<string | null>(null);
  const [proofName, setProofName] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dueDate = dueDateFromRef(ref, dueDay);

  const reset = () => {
    setRef('');
    setValueCents(defaultValueCents ?? 0);
    setPaid(false);
    setMethod('dinheiro');
    setProofDataUrl(null);
    setProofName(null);
  };

  const attach = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    if (!isAllowedProof(dataUrl)) {
      setError('Comprovante inválido: envie imagem ou PDF.');
      return;
    }
    setError(null);
    setProofDataUrl(dataUrl);
    setProofName(file.name);
  };

  const save = async () => {
    if (dueDate === null) {
      setError('Competência inválida. Use MM/AAAA.');
      return;
    }
    if (pending) return;
    if (valueCents <= 0) {
      setError('Informe um valor maior que zero.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await issue({
        ref: ref.trim(),
        valueCents,
        dueDate,
        ...(paid ? { paidAt: today, method, ...(proofDataUrl ? { proofDataUrl } : {}) } : {}),
      });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível adicionar o recibo.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1.5px dashed var(--petrol-500)',
        borderRadius: 'var(--r-md)',
        padding: 14,
        marginBottom: 10,
        boxShadow: 'var(--sh-1)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            fontWeight: 700,
            fontSize: '.78rem',
            letterSpacing: '.03em',
            textTransform: 'uppercase',
            color: 'var(--petrol-700)',
          }}
        >
          <Icon name="plus" size={15} strokeWidth={2.2} />
          Novo recibo
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          style={{
            width: 28,
            height: 28,
            display: 'grid',
            placeItems: 'center',
            border: 'none',
            borderRadius: 'var(--r-sm)',
            background: 'transparent',
            color: 'var(--ink-500)',
            cursor: 'pointer',
          }}
        >
          <Icon name="x" size={17} />
        </button>
      </div>

      <label
        style={{
          display: 'block',
          fontWeight: 600,
          fontSize: '.8rem',
          marginBottom: 5,
          color: 'var(--ink-700)',
        }}
      >
        Competência
        <input
          value={ref}
          onChange={(e) => setRef(maskCompetence(e.target.value))}
          placeholder="04/2026"
          aria-label="Competência"
          inputMode="numeric"
          style={{
            width: '100%',
            minHeight: 44,
            marginTop: 5,
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--r-sm)',
            padding: '0 12px',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: '.94rem',
            color: 'var(--ink-900)',
            background: 'var(--surface-2)',
          }}
        />
      </label>

      <div style={{ marginTop: 11 }}>
        <MoneyInput label="Valor" value={valueCents} onChange={setValueCents} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 11 }}>
        {STATUSES.map((s) => {
          const active = paid === s.paid;
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => setPaid(s.paid)}
              style={{
                flex: 1,
                minHeight: 40,
                borderRadius: 'var(--r-sm)',
                border: `1.5px solid ${active ? 'var(--petrol-600)' : 'var(--line)'}`,
                background: active ? 'var(--petrol-50)' : 'var(--surface)',
                color: active ? 'var(--petrol-800)' : 'var(--ink-500)',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: '.86rem',
                cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {paid && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 11 }}>
            {METHODS.map((m) => {
              const active = method === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  style={{
                    flex: 1,
                    minHeight: 38,
                    borderRadius: 'var(--r-sm)',
                    border: `1.5px solid ${active ? 'var(--petrol-600)' : 'var(--line)'}`,
                    background: active ? 'var(--petrol-50)' : 'var(--surface)',
                    color: active ? 'var(--petrol-800)' : 'var(--ink-500)',
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 600,
                    fontSize: '.84rem',
                    cursor: 'pointer',
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minHeight: 42,
              marginBottom: 11,
              border: '1.5px dashed var(--petrol-500)',
              borderRadius: 'var(--r-sm)',
              background: 'var(--petrol-50)',
              color: 'var(--petrol-800)',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              fontSize: '.86rem',
              cursor: 'pointer',
            }}
          >
            {proofName ? `Comprovante: ${proofName}` : 'Anexar comprovante'}
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => void attach(e)}
              style={{ display: 'none' }}
            />
          </label>
        </>
      )}

      {error && (
        <p
          role="alert"
          style={{ color: 'var(--atraso-700)', margin: '0 0 10px', fontSize: '.86rem' }}
        >
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          disabled={pending}
          onClick={() => void save()}
          style={{
            flex: 1,
            minHeight: 44,
            border: 'none',
            borderRadius: 'var(--r-sm)',
            background: 'var(--brass-500)',
            color: 'var(--petrol-900)',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: '.92rem',
            cursor: pending ? 'not-allowed' : 'pointer',
          }}
        >
          {pending ? 'Adicionando…' : 'Adicionar e continuar'}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            flex: 'none',
            minHeight: 44,
            padding: '0 16px',
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--r-sm)',
            background: 'var(--surface)',
            color: 'var(--ink-700)',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: '.92rem',
            cursor: 'pointer',
          }}
        >
          Concluir
        </button>
      </div>
      <div
        style={{ fontSize: '.78rem', color: 'var(--ink-500)', marginTop: 9, textAlign: 'center' }}
      >
        O card permanece aberto para você lançar vários recibos em sequência.
      </div>
    </div>
  );
}
