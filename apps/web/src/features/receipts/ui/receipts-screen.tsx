import type { ReactNode } from 'react';

import { formatIsoDate } from '@/shared/lib/dates';
import { formatBRL } from '@/shared/lib/money';
import { Icon } from '@/shared/ui/icon';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { PrimaryButton, SectionLabel, SurfaceCard } from '@/shared/ui/primitives';
import { StatusPill } from '@/shared/ui/status-pill';
import { TopBar } from '@/shared/ui/top-bar';

import { pendingReceipt } from '../domain/pending-receipt';
import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';
import { buildReceiptProof, proofFileName } from '../domain/receipt-proof';

import { methodLabel, receiptStatusView } from './receipt-status-view';
import { useReceipts } from './use-receipts';

// A paid receipt shows when it was paid; a pending one shows when it is due.
function receiptDateLabel(receipt: Receipt): string {
  if (receipt.status === 'pago') {
    return receipt.paidAt ? `Pago em ${formatIsoDate(receipt.paidAt)}` : 'Pago';
  }
  return receipt.dueDate ? `Vence em ${formatIsoDate(receipt.dueDate)}` : '';
}

type Props = {
  repository: ReceiptRepository;
  resident: { name: string; apt: string };
  onPay: (id: string) => void;
  bottomNav: ReactNode;
};

export function ReceiptsScreen({ repository, resident, onPay, bottomNav }: Props) {
  const receipts = useReceipts(repository);
  const firstName = resident.name.trim().split(/\s+/)[0] ?? resident.name;

  return (
    <Screen>
      <TopBar
        eyebrow={`Olá, ${firstName} · ${resident.apt} · Bloco 2`}
        title="Meus recibos"
        right={
          <span
            aria-hidden="true"
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              background: 'rgba(255,255,255,.12)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Icon name="bell" size={18} color="#fff" />
          </span>
        }
      />
      <ScreenBody>
        {receipts.isLoading && <p style={{ color: 'var(--ink-500)' }}>Carregando recibos…</p>}
        {receipts.isError && (
          <p style={{ color: 'var(--atraso-700)' }}>Não foi possível carregar os recibos.</p>
        )}
        {receipts.isSuccess && (
          <ReceiptsContent receipts={receipts.data} resident={resident} onPay={onPay} />
        )}
      </ScreenBody>
      {bottomNav}
    </Screen>
  );
}

function ReceiptsContent({
  receipts,
  resident,
  onPay,
}: {
  receipts: Receipt[];
  resident: { name: string; apt: string };
  onPay: (id: string) => void;
}) {
  const pending = pendingReceipt(receipts);
  return (
    <>
      {pending && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            padding: '13px 14px',
            borderRadius: 'var(--r-md)',
            background: 'var(--pend-bg)',
            border: '1px solid var(--pend-line)',
            color: 'var(--pend-700)',
            marginBottom: 6,
          }}
        >
          <Icon name="clock" size={20} color="var(--pend-700)" style={{ flex: 'none' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '.92rem' }}>
              Taxa de {pending.ref} pendente
            </div>
            <div style={{ fontSize: '.82rem' }}>{receiptDateLabel(pending)}</div>
          </div>
        </div>
      )}
      <SectionLabel>2026</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {receipts.map((receipt) => (
          <ReceiptTicket key={receipt.id} receipt={receipt} resident={resident} onPay={onPay} />
        ))}
      </div>
    </>
  );
}

function downloadProof(receipt: Receipt, resident: { name: string; apt: string }): void {
  const blob = new Blob([buildReceiptProof(receipt, resident)], {
    type: 'text/plain;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = proofFileName(receipt);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function ReceiptTicket({
  receipt,
  resident,
  onPay,
}: {
  receipt: Receipt;
  resident: { name: string; apt: string };
  onPay: (id: string) => void;
}) {
  const view = receiptStatusView(receipt.status);
  return (
    <SurfaceCard style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '.72rem',
              letterSpacing: '.04em',
              textTransform: 'uppercase',
              color: 'var(--ink-500)',
              fontWeight: 600,
            }}
          >
            REF · {receipt.ref}
          </div>
          <div style={{ fontWeight: 600, fontSize: '1rem' }}>{receipt.title}</div>
        </div>
        <StatusPill tone={view.tone} label={view.label} size="sm" />
      </div>
      <div style={{ borderTop: '1px dashed var(--line)' }} />
      <div style={{ background: 'var(--surface-2)', padding: '13px 14px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <span style={{ fontSize: '.86rem', color: 'var(--ink-500)' }}>
            {receiptDateLabel(receipt)}
          </span>
          <span className="fraunces" style={{ fontSize: '1.2rem', fontWeight: 700 }}>
            R$ {formatBRL(receipt.valueCents)}
          </span>
        </div>
        {receipt.status === 'pago' && receipt.method && (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '.86rem',
                color: 'var(--pago-700)',
              }}
            >
              <Icon name="check" size={17} color="var(--pago-700)" strokeWidth={2.4} />
              <span>
                Pago via <b>{methodLabel(receipt.method)}</b>
              </span>
            </div>
            <button
              type="button"
              onClick={() => downloadProof(receipt, resident)}
              style={{
                marginTop: 10,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                border: 'none',
                background: 'transparent',
                padding: 0,
                color: 'var(--petrol-800)',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: '.86rem',
                cursor: 'pointer',
              }}
            >
              <Icon name="download" size={16} color="var(--petrol-800)" />
              Baixar comprovante
            </button>
          </div>
        )}
        {receipt.status === 'pendente' && (
          <div style={{ marginTop: 12 }}>
            <PrimaryButton icon="card" onClick={() => onPay(receipt.id)}>
              Pagar taxa
            </PrimaryButton>
          </div>
        )}
      </div>
    </SurfaceCard>
  );
}
