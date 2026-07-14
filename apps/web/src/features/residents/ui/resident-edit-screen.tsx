import { useEffect, useState, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { Receipt } from '@/features/receipts/domain/receipt';
import type { ReceiptRepository } from '@/features/receipts/domain/receipt-repository';
import { formatBRL } from '@/shared/lib/money';
import { Icon } from '@/shared/ui/icon';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { Field, PrimaryButton, SectionLabel, SurfaceCard } from '@/shared/ui/primitives';
import { StatusPill } from '@/shared/ui/status-pill';

import { getResident } from '../domain/get-resident';
import type { ResidentStatus } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';

import { residentStatusView } from './resident-status-view';
import {
  residentsQueryKey,
  useApartmentReceipts,
  useApartmentResidents,
  useDeactivateResident,
  useSaveResident,
} from './use-residents';

const EMPTY = { name: '', apt: '', phone: '', email: '', status: 'em_dia' as ResidentStatus };

type Props = {
  repository: ResidentRepository;
  receiptRepository: ReceiptRepository;
  residentId?: string;
  onBack: () => void;
  onCreateLogin?: () => void;
  onIssueCharge?: () => void;
};

export function ResidentEditScreen({
  repository,
  receiptRepository,
  residentId,
  onBack,
  onCreateLogin,
  onIssueCharge,
}: Props) {
  const existing = useQuery({
    queryKey: [...residentsQueryKey, residentId],
    queryFn: () => getResident(repository, residentId as string),
    enabled: residentId !== undefined,
  });
  const save = useSaveResident(repository);
  const deactivate = useDeactivateResident(repository);
  const [form, setForm] = useState(EMPTY);
  const [showArchived, setShowArchived] = useState(false);

  const apartmentId = existing.data?.apartmentId;
  const history = useApartmentResidents(repository, apartmentId);
  const receipts = useApartmentReceipts(receiptRepository, apartmentId);
  const archived = (history.data ?? []).filter((r) => !r.active && r.id !== residentId);

  useEffect(() => {
    if (existing.data) {
      const { name, apt, phone, email, status } = existing.data;
      setForm({ name, apt, phone, email, status });
    }
  }, [existing.data]);

  const set = (key: keyof typeof EMPTY) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = () => save.mutate({ ...form, id: residentId }, { onSuccess: onBack });
  const moveOut = () => {
    if (residentId) deactivate.mutate(residentId, { onSuccess: onBack });
  };

  const saveError = save.isError
    ? save.error instanceof Error
      ? save.error.message
      : 'Não foi possível salvar.'
    : null;
  const isActive = existing.data?.active !== false;
  const statusView = existing.data ? residentStatusView(existing.data.status) : null;
  const title = residentId ? (existing.data?.apt ?? 'Apartamento') : 'Novo apartamento';
  const moradorSubtitle = residentId && isActive ? 'Morador atual' : 'Morador';

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
            Apartamentos · Bloco 2
          </div>
          <div className="fraunces" style={{ fontSize: '1.35rem', fontWeight: 600, color: '#fff' }}>
            {title}
          </div>
        </div>
        {residentId && statusView && <StatusPill tone={statusView.tone} label={statusView.label} />}
      </div>
      <ScreenBody>
        <label style={{ display: 'block', marginBottom: 18 }}>
          <span
            style={{
              display: 'block',
              fontWeight: 600,
              fontSize: '.9rem',
              marginBottom: 7,
              color: 'var(--ink-900)',
            }}
          >
            Número do apartamento
          </span>
          <input
            value={form.apt}
            onChange={(e: ChangeEvent<HTMLInputElement>) => set('apt')(e.target.value)}
            placeholder="Ex.: Apto 302"
            style={{
              width: '100%',
              minHeight: 54,
              border: '1.5px solid var(--petrol-100)',
              borderRadius: 'var(--r-md)',
              padding: '0 16px',
              fontFamily: "'Fraunces', serif",
              fontWeight: 600,
              fontSize: '1.35rem',
              color: 'var(--petrol-900)',
              background: 'var(--surface)',
            }}
          />
        </label>

        <div style={{ borderTop: '1px solid var(--line)', margin: '2px 0 4px' }} />

        <SectionLabel
          right={
            residentId && isActive ? (
              <button type="button" onClick={moveOut} style={archiveButtonStyle}>
                <Icon name="logout" size={15} />
                {deactivate.isPending ? 'Arquivando…' : 'Arquivar morador'}
              </button>
            ) : undefined
          }
        >
          {moradorSubtitle}
        </SectionLabel>

        <Field
          label="Nome completo"
          value={form.name}
          onChange={set('name')}
          placeholder="Ex.: Maria Ribeiro"
        />
        <Field
          label="Telefone"
          value={form.phone}
          onChange={set('phone')}
          placeholder="(11) 90000-0000"
        />
        <Field
          label="E-mail"
          value={form.email}
          onChange={set('email')}
          placeholder="morador@email.com"
          type="email"
        />

        {apartmentId && (
          <>
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              style={archiveButtonStyle}
            >
              <Icon name="clock" size={15} />
              Ver moradores antigos
            </button>
            {showArchived && (
              <div style={{ marginTop: 12 }}>
                {archived.length === 0 ? (
                  <div
                    style={{
                      padding: 16,
                      textAlign: 'center',
                      fontSize: '.86rem',
                      color: 'var(--ink-500)',
                      background: 'var(--surface-2)',
                      border: '1px dashed var(--line)',
                      borderRadius: 'var(--r-md)',
                    }}
                  >
                    Nenhum morador antigo registrado.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {archived.map((r) => (
                      <SurfaceCard
                        key={r.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 14px',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '.95rem' }}>{r.name}</div>
                          <div style={{ fontSize: '.8rem', color: 'var(--ink-500)' }}>
                            {r.phone}
                          </div>
                        </div>
                      </SurfaceCard>
                    ))}
                  </div>
                )}
              </div>
            )}

            <ReceiptsSection receipts={receipts.data ?? []} onIssueCharge={onIssueCharge} />
          </>
        )}

        {saveError && (
          <p role="alert" style={{ color: 'var(--atraso-700)', margin: '16px 0 12px' }}>
            {saveError}
          </p>
        )}

        <div style={{ marginTop: 20 }}>
          <PrimaryButton icon="check" onClick={submit}>
            {residentId ? 'Salvar alterações' : 'Cadastrar apartamento'}
          </PrimaryButton>
        </div>

        {onCreateLogin && (
          <button type="button" onClick={onCreateLogin} style={secondaryButtonStyle}>
            Criar acesso do morador
          </button>
        )}
      </ScreenBody>
    </Screen>
  );
}

function ReceiptsSection({
  receipts,
  onIssueCharge,
}: {
  receipts: Receipt[];
  onIssueCharge?: () => void;
}) {
  return (
    <>
      <SectionLabel
        right={
          onIssueCharge ? (
            <button type="button" onClick={onIssueCharge} style={archiveButtonStyle}>
              <Icon name="plus" size={15} />
              Emitir cobrança
            </button>
          ) : undefined
        }
      >
        Recibos de pagamento
      </SectionLabel>
      {receipts.length === 0 ? (
        <p style={{ color: 'var(--ink-500)', padding: '4px 2px', fontSize: '.9rem' }}>
          Nenhum recibo emitido para este apartamento.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {receipts.map((r) => (
            <SurfaceCard
              key={r.id}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '.95rem' }}>{r.title}</div>
                <div style={{ fontSize: '.8rem', color: 'var(--ink-500)' }}>REF · {r.ref}</div>
              </div>
              <span
                className="fraunces"
                style={{ fontWeight: 700, fontSize: '.98rem', fontVariantNumeric: 'tabular-nums' }}
              >
                R$ {formatBRL(r.valueCents)}
              </span>
              <StatusPill
                tone={r.status === 'pago' ? 'pago' : 'pendente'}
                label={r.status === 'pago' ? 'Pago' : 'Pendente'}
              />
            </SurfaceCard>
          ))}
        </div>
      )}
    </>
  );
}

const archiveButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  minHeight: 34,
  padding: '0 12px',
  border: '1.5px solid var(--petrol-100)',
  borderRadius: 'var(--r-sm)',
  background: 'var(--petrol-50)',
  color: 'var(--petrol-800)',
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '.82rem',
  cursor: 'pointer',
} as const;

const secondaryButtonStyle = {
  width: '100%',
  minHeight: 50,
  marginTop: 12,
  borderRadius: 'var(--r-md)',
  border: '1.5px solid var(--petrol-600)',
  background: 'var(--surface)',
  color: 'var(--petrol-800)',
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '1rem',
  cursor: 'pointer',
} as const;
