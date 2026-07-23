import { useEffect, useState, type ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apartmentReceiptTotals } from '@/features/receipts/domain/apartment-receipt-totals';
import type { Receipt, ReceiptMethod } from '@/features/receipts/domain/receipt';
import type { ReceiptRepository } from '@/features/receipts/domain/receipt-repository';
import { sortByDueDateDesc } from '@/features/receipts/domain/sort-by-due-date';
import { formatIsoDate } from '@/shared/lib/dates';
import { formatBRL } from '@/shared/lib/money';
import { maskPhone } from '@/shared/lib/phone';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { DateInput } from '@/shared/ui/date-input';
import { EmptyState } from '@/shared/ui/empty-state';
import { Icon } from '@/shared/ui/icon';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { Field, PrimaryButton, SectionLabel, SurfaceCard } from '@/shared/ui/primitives';
import { StatusPill } from '@/shared/ui/status-pill';
import { MoneyInput } from '@/shared/ui/money-input';

import { apartmentLabel, apartmentNumber } from '../domain/apartment';
import { getResident } from '../domain/get-resident';
import type { ResidentStatus } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';

import { NewReceiptCard } from './new-receipt-card';
import { ResidentEditSkeleton } from './resident-edit-skeleton';
import { residentStatusView } from './resident-status-view';
import {
  residentsQueryKey,
  useApartmentReceipts,
  useApartmentResidents,
  useDeactivateResident,
  useSaveResident,
} from './use-residents';

const EMPTY = { name: '', apt: '', phone: '', email: '', status: 'em_dia' as ResidentStatus };

type RegisterPayment = (input: {
  receiptId: string;
  method: ReceiptMethod;
  paidAt: string;
}) => Promise<void>;

type EditReceipt = (input: {
  receiptId: string;
  ref: string;
  title: string;
  valueCents: number;
  dueDate: string;
}) => Promise<void>;

type ConfirmPayment = (receiptId: string, paidAt: string) => Promise<void>;
type RejectPayment = (receiptId: string) => Promise<void>;

type OverrideStatus = (input: {
  residentId: string;
  status: ResidentStatus | null;
}) => Promise<void>;

type Props = {
  repository: ResidentRepository;
  receiptRepository: ReceiptRepository;
  residentId?: string;
  onBack: () => void;
  onCreateLogin?: () => void;
  dueDay?: number;
  defaultReceiptValueCents?: number;
  issueCharge?: (input: {
    residentId: string;
    ref: string;
    title: string;
    valueCents: number;
    dueDate: string;
    paidAt?: string;
    method?: ReceiptMethod;
    proofDataUrl?: string;
  }) => Promise<void>;
  registerPayment?: RegisterPayment;
  onEditReceipt?: EditReceipt;
  onConfirmPayment?: ConfirmPayment;
  onRejectPayment?: RejectPayment;
  onOverrideStatus?: OverrideStatus;
};

export function ResidentEditScreen({
  repository,
  receiptRepository,
  residentId,
  onBack,
  onCreateLogin,
  dueDay = 15,
  defaultReceiptValueCents = 0,
  issueCharge,
  registerPayment,
  onEditReceipt,
  onConfirmPayment,
  onRejectPayment,
  onOverrideStatus,
}: Props) {
  const queryClient = useQueryClient();
  const registration = useMutation({
    mutationFn: (input: { receiptId: string; method: ReceiptMethod; paidAt: string }) =>
      (registerPayment ?? (async () => {}))(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: residentsQueryKey });
    },
  });
  const editing = useMutation({
    mutationFn: (input: {
      receiptId: string;
      ref: string;
      title: string;
      valueCents: number;
      dueDate: string;
    }) => (onEditReceipt ?? (async () => {}))(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: residentsQueryKey });
    },
  });
  const confirming = useMutation({
    mutationFn: (input: { receiptId: string; paidAt: string }) =>
      (onConfirmPayment ?? (async () => {}))(input.receiptId, input.paidAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: residentsQueryKey });
    },
  });
  const rejecting = useMutation({
    mutationFn: (receiptId: string) => (onRejectPayment ?? (async () => {}))(receiptId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: residentsQueryKey });
    },
  });
  const archivingReceipt = useMutation({
    mutationFn: (receiptId: string) => receiptRepository.archive(receiptId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: residentsQueryKey });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
  const overridingStatus = useMutation({
    mutationFn: (input: { residentId: string; status: ResidentStatus | null }) =>
      (onOverrideStatus ?? (async () => {}))(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: residentsQueryKey });
    },
  });
  const existing = useQuery({
    queryKey: [...residentsQueryKey, residentId],
    queryFn: () => getResident(repository, residentId as string),
    enabled: residentId !== undefined,
  });
  const save = useSaveResident(repository);
  const deactivate = useDeactivateResident(repository);
  const [form, setForm] = useState(EMPTY);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmingMoveOut, setConfirmingMoveOut] = useState(false);

  const apartmentId = existing.data?.apartmentId;
  const history = useApartmentResidents(repository, apartmentId);
  const receipts = useApartmentReceipts(receiptRepository, apartmentId);
  const archived = (history.data ?? []).filter((r) => !r.active && r.id !== residentId);

  useEffect(() => {
    if (existing.data) {
      const { name, apt, phone, email, status } = existing.data;
      setForm({ name, apt: apartmentNumber(apt), phone, email, status });
    }
  }, [existing.data]);

  const set = (key: keyof typeof EMPTY) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submitNewReceipt =
    issueCharge && residentId
      ? async (input: {
          ref: string;
          valueCents: number;
          dueDate: string;
          paidAt?: string;
          method?: ReceiptMethod;
          proofDataUrl?: string;
        }) => {
          await issueCharge({
            residentId,
            title: 'Taxa condominial',
            ...input,
          });
          queryClient.invalidateQueries({ queryKey: ['receipts'] });
          queryClient.invalidateQueries({ queryKey: residentsQueryKey });
        }
      : undefined;

  const submit = () =>
    save.mutate({ ...form, apt: apartmentLabel(form.apt), id: residentId }, { onSuccess: onBack });
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
  const hasStatusOverride = Boolean(existing.data?.statusOverride);
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
        {residentId && statusView && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <StatusPill tone={statusView.tone} label={statusView.label} />
            {hasStatusOverride && (
              <span style={{ fontSize: '.7rem', color: '#A9C6C9' }}>manual</span>
            )}
          </div>
        )}
      </div>
      <ScreenBody>
        {residentId && existing.isLoading && <ResidentEditSkeleton />}
        {(!residentId || !existing.isLoading) && (
          <>
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
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: 16,
                    fontFamily: "'Fraunces', serif",
                    fontWeight: 600,
                    fontSize: '1.35rem',
                    color: 'var(--ink-300)',
                  }}
                >
                  Apto
                </span>
                <input
                  value={form.apt}
                  inputMode="numeric"
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    set('apt')(e.target.value.replace(/\D/g, ''))
                  }
                  placeholder="302"
                  aria-label="Número do apartamento"
                  style={{
                    width: '100%',
                    minHeight: 54,
                    border: '1.5px solid var(--petrol-100)',
                    borderRadius: 'var(--r-md)',
                    padding: '0 16px 0 74px',
                    fontFamily: "'Fraunces', serif",
                    fontWeight: 600,
                    fontSize: '1.35rem',
                    color: 'var(--petrol-900)',
                    background: 'var(--surface)',
                  }}
                />
              </div>
            </label>

            <div style={{ borderTop: '1px solid var(--line)', margin: '2px 0 4px' }} />

            <SectionLabel
              right={
                residentId && isActive ? (
                  <button
                    type="button"
                    onClick={() => setConfirmingMoveOut(true)}
                    style={archiveButtonStyle}
                  >
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
              onChange={(v) => set('phone')(maskPhone(v))}
              placeholder="(11) 90000-0000"
            />
            <Field
              label="E-mail"
              value={form.email}
              onChange={set('email')}
              placeholder="morador@email.com"
              type="email"
            />

            {residentId && onOverrideStatus && (
              <StatusOverrideControl
                currentOverride={existing.data?.statusOverride ?? null}
                onOverride={(status) => overridingStatus.mutate({ residentId, status })}
                isPending={overridingStatus.isPending}
              />
            )}

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
                      <EmptyState title="Nenhum morador antigo registrado" />
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

                <ReceiptsSection
                  receipts={receipts.data ?? []}
                  dueDay={dueDay}
                  defaultReceiptValueCents={defaultReceiptValueCents}
                  issue={submitNewReceipt}
                  onRegisterPayment={
                    registerPayment ? (input) => registration.mutate(input) : undefined
                  }
                  isRegistering={registration.isPending}
                  onEditReceipt={onEditReceipt ? (input) => editing.mutate(input) : undefined}
                  isEditing={editing.isPending}
                  onConfirmPayment={
                    onConfirmPayment
                      ? (receiptId, paidAt) => confirming.mutate({ receiptId, paidAt })
                      : undefined
                  }
                  isConfirming={confirming.isPending}
                  onRejectPayment={
                    onRejectPayment ? (receiptId) => rejecting.mutate(receiptId) : undefined
                  }
                  isRejecting={rejecting.isPending}
                  onArchiveReceipt={(receiptId) => archivingReceipt.mutate(receiptId)}
                  isArchiving={archivingReceipt.isPending}
                />
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
          </>
        )}
      </ScreenBody>
      <ConfirmDialog
        open={confirmingMoveOut}
        title={`Registrar saída de ${existing.data?.name || 'deste morador'}?`}
        message={`${existing.data?.name || 'O morador'} deixa de ser o morador ativo do ${existing.data?.apt ?? 'apartamento'}. O histórico do apartamento é preservado.`}
        confirmLabel="Confirmar saída"
        tone="danger"
        isPending={deactivate.isPending}
        onConfirm={() => {
          setConfirmingMoveOut(false);
          moveOut();
        }}
        onCancel={() => setConfirmingMoveOut(false)}
      />
    </Screen>
  );
}

const STATUS_OPTIONS: { value: ResidentStatus | null; label: string }[] = [
  { value: null, label: 'Automático' },
  { value: 'em_dia', label: 'Em dia' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'atrasado', label: 'Atrasado' },
];

function StatusOverrideControl({
  currentOverride,
  onOverride,
  isPending,
}: {
  currentOverride: ResidentStatus | null;
  onOverride: (status: ResidentStatus | null) => void;
  isPending: boolean;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <span
        style={{
          display: 'block',
          fontWeight: 600,
          fontSize: '.9rem',
          marginBottom: 7,
          color: 'var(--ink-900)',
        }}
      >
        Status de pagamento
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {STATUS_OPTIONS.map((option) => {
          const active = currentOverride === option.value;
          return (
            <button
              key={option.label}
              type="button"
              disabled={isPending}
              aria-pressed={active}
              onClick={() => onOverride(option.value)}
              style={{
                minHeight: 38,
                padding: '0 14px',
                borderRadius: 999,
                border: `1.5px solid ${active ? 'var(--petrol-600)' : 'var(--line)'}`,
                background: active ? 'var(--petrol-50)' : 'var(--surface)',
                color: active ? 'var(--petrol-800)' : 'var(--ink-500)',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: '.82rem',
                cursor: 'pointer',
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const METHODS: { value: ReceiptMethod; label: string }[] = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
];

function receiptDateInfo(receipt: Receipt): string {
  if (receipt.status === 'pago') {
    return receipt.paidAt ? `Pago em ${formatIsoDate(receipt.paidAt)}` : 'Pago';
  }
  return receipt.dueDate ? `Vence ${formatIsoDate(receipt.dueDate)}` : '';
}

type RegisterPaymentHandler = (input: {
  receiptId: string;
  method: ReceiptMethod;
  paidAt: string;
}) => void;

type EditReceiptHandler = (input: {
  receiptId: string;
  ref: string;
  title: string;
  valueCents: number;
  dueDate: string;
}) => void;

type ConfirmPaymentHandler = (receiptId: string, paidAt: string) => void;
type RejectPaymentHandler = (receiptId: string) => void;
type ArchiveReceiptHandler = (receiptId: string) => void;

function ReceiptsSection({
  receipts,
  dueDay,
  defaultReceiptValueCents,
  issue,
  onRegisterPayment,
  isRegistering,
  onEditReceipt,
  isEditing,
  onConfirmPayment,
  isConfirming,
  onRejectPayment,
  isRejecting,
  onArchiveReceipt,
  isArchiving,
}: {
  receipts: Receipt[];
  dueDay: number;
  defaultReceiptValueCents?: number;
  issue?: (input: {
    ref: string;
    valueCents: number;
    dueDate: string;
    paidAt?: string;
    method?: ReceiptMethod;
    proofDataUrl?: string;
  }) => Promise<void>;
  onRegisterPayment?: RegisterPaymentHandler;
  isRegistering?: boolean;
  onEditReceipt?: EditReceiptHandler;
  isEditing?: boolean;
  onConfirmPayment?: ConfirmPaymentHandler;
  isConfirming?: boolean;
  onRejectPayment?: RejectPaymentHandler;
  isRejecting?: boolean;
  onArchiveReceipt?: ArchiveReceiptHandler;
  isArchiving?: boolean;
}) {
  const [showNewReceipt, setShowNewReceipt] = useState(false);
  const totals = apartmentReceiptTotals(receipts);
  const ordered = sortByDueDateDesc(receipts);
  return (
    <>
      <SectionLabel
        right={
          issue ? (
            <button
              type="button"
              onClick={() => setShowNewReceipt(true)}
              style={archiveButtonStyle}
            >
              <Icon name="plus" size={15} />
              Adicionar
            </button>
          ) : undefined
        }
      >
        Recibos de pagamento
      </SectionLabel>
      {receipts.length > 0 && (
        <div style={{ display: 'flex', gap: 10, margin: '4px 0 14px' }}>
          <SummaryTile label="Recebido" value={formatBRL(totals.paidCents)} />
          <SummaryTile label="Em aberto" value={formatBRL(totals.openCents)} />
        </div>
      )}
      {showNewReceipt && issue && (
        <NewReceiptCard
          dueDay={dueDay}
          issue={issue}
          onClose={() => setShowNewReceipt(false)}
          defaultValueCents={defaultReceiptValueCents}
        />
      )}
      {receipts.length === 0 ? (
        <p style={{ color: 'var(--ink-500)', padding: '4px 2px', fontSize: '.9rem' }}>
          Nenhum recibo emitido para este apartamento.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ordered.map((r) => (
            <ReceiptLedgerRow
              key={r.id}
              receipt={r}
              onRegisterPayment={onRegisterPayment}
              isRegistering={isRegistering}
              onEditReceipt={onEditReceipt}
              isEditing={isEditing}
              onConfirmPayment={onConfirmPayment}
              isConfirming={isConfirming}
              onRejectPayment={onRejectPayment}
              isRejecting={isRejecting}
              onArchiveReceipt={onArchiveReceipt}
              isArchiving={isArchiving}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ReceiptLedgerRow({
  receipt,
  onRegisterPayment,
  isRegistering,
  onEditReceipt,
  isEditing,
  onConfirmPayment,
  isConfirming,
  onRejectPayment,
  isRejecting,
  onArchiveReceipt,
  isArchiving,
}: {
  receipt: Receipt;
  onRegisterPayment?: RegisterPaymentHandler;
  isRegistering?: boolean;
  onEditReceipt?: EditReceiptHandler;
  isEditing?: boolean;
  onConfirmPayment?: ConfirmPaymentHandler;
  isConfirming?: boolean;
  onRejectPayment?: RejectPaymentHandler;
  isRejecting?: boolean;
  onArchiveReceipt?: ArchiveReceiptHandler;
  isArchiving?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [paidAt, setPaidAt] = useState('');
  const [confirmPaidAt, setConfirmPaidAt] = useState('');
  const [method, setMethod] = useState<ReceiptMethod>('dinheiro');
  const [editOpen, setEditOpen] = useState(false);
  const [editRef, setEditRef] = useState(receipt.ref);
  const [editValueCents, setEditValueCents] = useState(receipt.valueCents);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [editDueDate, setEditDueDate] = useState(receipt.dueDate ?? '');
  const canRegister = receipt.status === 'pendente' && onRegisterPayment !== undefined;
  const canEdit = onEditReceipt !== undefined;
  const isUnderReview = receipt.status === 'em_analise';
  const canReview =
    isUnderReview && onConfirmPayment !== undefined && onRejectPayment !== undefined;

  const openEdit = () => {
    setEditRef(receipt.ref);
    setEditValueCents(receipt.valueCents);
    setEditDueDate(receipt.dueDate ?? '');
    setEditOpen(true);
  };

  return (
    <SurfaceCard style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '.95rem' }}>{receipt.title}</div>
          <div style={{ fontSize: '.8rem', color: 'var(--ink-500)' }}>
            REF · {receipt.ref}
            {receiptDateInfo(receipt) ? ` · ${receiptDateInfo(receipt)}` : ''}
          </div>
        </div>
        <span
          className="fraunces"
          style={{ fontWeight: 700, fontSize: '.98rem', fontVariantNumeric: 'tabular-nums' }}
        >
          R$ {formatBRL(receipt.valueCents)}
        </span>
        <StatusPill
          tone={receipt.status === 'pago' ? 'pago' : isUnderReview ? 'info' : 'pendente'}
          label={receipt.status === 'pago' ? 'Pago' : isUnderReview ? 'Em análise' : 'Pendente'}
        />
      </div>

      {(canRegister || canEdit || onArchiveReceipt) && !open && !editOpen && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {canRegister && (
            <button type="button" onClick={() => setOpen(true)} style={archiveButtonStyle}>
              <Icon name="check" size={15} />
              Dar baixa
            </button>
          )}
          {canEdit && (
            <button type="button" onClick={openEdit} style={archiveButtonStyle}>
              <Icon name="edit" size={15} />
              Editar
            </button>
          )}
          {onArchiveReceipt && (
            <button
              type="button"
              onClick={() => setConfirmingArchive(true)}
              style={{ ...archiveButtonStyle, color: 'var(--atraso-700)' }}
            >
              <Icon name="x" size={15} />
              Excluir
            </button>
          )}
        </div>
      )}

      {isUnderReview && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {receipt.hasProof && (
            <a
              href={`/api/receipts/${receipt.id}/proof`}
              target="_blank"
              rel="noreferrer"
              style={{ ...archiveButtonStyle, textDecoration: 'none' }}
            >
              <Icon name="receipt" size={15} />
              Ver comprovante
            </a>
          )}
          {canReview && (
            <>
              <div style={{ flexBasis: '100%' }}>
                <DateInput
                  label="Data do pagamento"
                  value={confirmPaidAt}
                  onChange={setConfirmPaidAt}
                />
              </div>
              <button
                type="button"
                disabled={isConfirming || isRejecting || !confirmPaidAt}
                onClick={() => onConfirmPayment?.(receipt.id, confirmPaidAt)}
                style={{
                  ...archiveButtonStyle,
                  border: 'none',
                  background: 'var(--brass-500)',
                  color: 'var(--petrol-900)',
                }}
              >
                <Icon name="check" size={15} />
                {isConfirming ? 'Confirmando…' : 'Confirmar'}
              </button>
              <button
                type="button"
                disabled={isConfirming || isRejecting}
                onClick={() => onRejectPayment?.(receipt.id)}
                style={archiveButtonStyle}
              >
                Rejeitar
              </button>
            </>
          )}
        </div>
      )}

      {canEdit && editOpen && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label="Referência" value={editRef} onChange={setEditRef} />
          <MoneyInput label="Valor" value={editValueCents} onChange={setEditValueCents} />
          <DateInput label="Vencimento" value={editDueDate} onChange={setEditDueDate} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={isEditing || !editRef.trim() || !editDueDate || editValueCents <= 0}
              onClick={() =>
                onEditReceipt?.({
                  receiptId: receipt.id,
                  ref: editRef.trim(),
                  title: receipt.title,
                  valueCents: editValueCents,
                  dueDate: editDueDate,
                })
              }
              style={{
                flex: 1,
                minHeight: 44,
                border: 'none',
                borderRadius: 'var(--r-sm)',
                background: 'var(--brass-500)',
                color: 'var(--petrol-900)',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: '.9rem',
                cursor: 'pointer',
              }}
            >
              {isEditing ? 'Salvando…' : 'Salvar edição'}
            </button>
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              style={{ ...archiveButtonStyle, minHeight: 44 }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {canRegister && open && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <DateInput label="Data do pagamento" value={paidAt} onChange={setPaidAt} />
          <div style={{ display: 'flex', gap: 6 }}>
            {METHODS.map((m) => {
              const active = method === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  style={{
                    flex: 1,
                    minHeight: 40,
                    borderRadius: 'var(--r-sm)',
                    border: `1.5px solid ${active ? 'var(--petrol-600)' : 'var(--line)'}`,
                    background: active ? 'var(--petrol-50)' : 'var(--surface)',
                    color: active ? 'var(--petrol-800)' : 'var(--ink-500)',
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 600,
                    fontSize: '.82rem',
                    cursor: 'pointer',
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={isRegistering || !paidAt}
              onClick={() => onRegisterPayment?.({ receiptId: receipt.id, method, paidAt })}
              style={{
                flex: 1,
                minHeight: 44,
                border: 'none',
                borderRadius: 'var(--r-sm)',
                background: 'var(--brass-500)',
                color: 'var(--petrol-900)',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: '.9rem',
                cursor: 'pointer',
              }}
            >
              {isRegistering ? 'Registrando…' : 'Confirmar baixa'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ ...archiveButtonStyle, minHeight: 44 }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmingArchive}
        title="Excluir este recibo?"
        confirmLabel="Excluir"
        tone="danger"
        isPending={isArchiving}
        onConfirm={() => {
          setConfirmingArchive(false);
          onArchiveReceipt?.(receipt.id);
        }}
        onCancel={() => setConfirmingArchive(false)}
      />
    </SurfaceCard>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: 1,
        background: 'var(--petrol-50)',
        borderRadius: 12,
        padding: '10px 14px',
      }}
    >
      <div style={{ fontSize: '.72rem', color: 'var(--ink-500)', fontWeight: 500 }}>{label}</div>
      <div
        className="fraunces"
        style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--petrol-800)' }}
      >
        R$ {value}
      </div>
    </div>
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
