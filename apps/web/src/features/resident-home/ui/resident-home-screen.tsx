import type { ReactNode } from 'react';

import { pendingReceipt } from '@/features/receipts/domain/pending-receipt';
import type { Receipt } from '@/features/receipts/domain/receipt';
import type { ReceiptRepository } from '@/features/receipts/domain/receipt-repository';
import { formatIsoDate } from '@/shared/lib/dates';
import { formatBRL } from '@/shared/lib/money';
import { Icon, type IconName } from '@/shared/ui/icon';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { IconBadge, PrimaryButton, SectionLabel, SurfaceCard } from '@/shared/ui/primitives';
import { StatusView } from '@/shared/ui/status-view';
import { TopBar } from '@/shared/ui/top-bar';

import { firstName } from './current-resident';
import { useResidentHome } from './use-resident-home';

type Props = {
  receiptRepository: ReceiptRepository;
  resident: { name: string; apt: string };
  onGoReceipts: () => void;
  onGoFinance: () => void;
  onGoNotices: () => void;
  bottomNav: ReactNode;
};

export function ResidentHomeScreen({
  receiptRepository,
  resident,
  onGoReceipts,
  onGoFinance,
  onGoNotices,
  bottomNav,
}: Props) {
  const home = useResidentHome(receiptRepository);

  return (
    <Screen>
      <TopBar
        eyebrow={`${resident.apt} · Bloco 2`}
        title={`Olá, ${firstName(resident.name)}`}
        right={<NoticesButton onClick={onGoNotices} />}
      />
      <ScreenBody>
        {home.isLoading && <StatusView variant="loading" message="Carregando…" />}
        {home.isError && (
          <StatusView
            variant="error"
            message="Não foi possível carregar sua taxa."
            onRetry={() => void home.refetch()}
          />
        )}
        {home.isSuccess && (
          <HomeContent receipts={home.data} onGoReceipts={onGoReceipts} onGoFinance={onGoFinance} />
        )}
      </ScreenBody>
      {bottomNav}
    </Screen>
  );
}

function HomeContent({
  receipts,
  onGoReceipts,
  onGoFinance,
}: {
  receipts: Receipt[];
  onGoReceipts: () => void;
  onGoFinance: () => void;
}) {
  const pending = pendingReceipt(receipts);
  return (
    <>
      <SectionLabel>Próxima taxa</SectionLabel>
      {pending ? <NextFeeHero receipt={pending} onPay={onGoReceipts} /> : <AllClearHero />}

      <SectionLabel>Atalhos</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Shortcut icon="receipt" title="Recibos" onClick={onGoReceipts} />
        <Shortcut icon="building" title="Condomínio" onClick={onGoFinance} />
      </div>
    </>
  );
}

function NoticesButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Avisos"
      onClick={onClick}
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: 'rgba(255,255,255,.12)',
        display: 'grid',
        placeItems: 'center',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      <Icon name="bell" size={19} color="#fff" />
    </button>
  );
}

function NextFeeHero({ receipt, onPay }: { receipt: Receipt; onPay: () => void }) {
  return (
    <SurfaceCard
      style={{
        background: 'linear-gradient(135deg, var(--petrol-700), var(--petrol-800))',
        border: 'none',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--sh-2)',
        color: '#fff',
        padding: '18px 18px 20px',
      }}
    >
      <div style={{ fontSize: '.82rem', color: '#A9C6C9', fontWeight: 500 }}>
        Taxa condominial · {receipt.ref}
      </div>
      <div
        className="fraunces"
        style={{
          fontSize: '2.4rem',
          fontWeight: 600,
          lineHeight: 1.1,
          marginTop: 4,
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
        }}
      >
        <span style={{ fontSize: '1.1rem', color: 'var(--brass-500)', fontWeight: 600 }}>R$</span>
        <span>{formatBRL(receipt.valueCents)}</span>
      </div>
      <div style={{ fontSize: '.82rem', color: '#A9C6C9', marginTop: 6 }}>
        {receipt.dueDate ? `Vence em ${formatIsoDate(receipt.dueDate)}` : ''}
      </div>
      <div style={{ marginTop: 16 }}>
        <PrimaryButton icon="card" onClick={onPay}>
          Pagar taxa
        </PrimaryButton>
      </div>
    </SurfaceCard>
  );
}

function AllClearHero() {
  return (
    <SurfaceCard
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: '18px 18px 20px',
        borderRadius: 'var(--r-lg)',
      }}
    >
      <IconBadge icon="check" bg="var(--petrol-50)" color="var(--pago-700)" />
      <div>
        <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--petrol-900)' }}>
          Tudo em dia
        </div>
        <div style={{ fontSize: '.86rem', color: 'var(--ink-500)' }}>
          Nenhuma taxa pendente no momento.
        </div>
      </div>
    </SurfaceCard>
  );
}

function Shortcut({
  icon,
  title,
  onClick,
}: {
  icon: IconName;
  title: string;
  onClick: () => void;
}) {
  return (
    <SurfaceCard
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 9,
        padding: '15px 10px',
        textAlign: 'center',
      }}
    >
      <IconBadge icon={icon} />
      <div style={{ fontWeight: 600, fontSize: '.9rem', color: 'var(--petrol-900)' }}>{title}</div>
    </SurfaceCard>
  );
}
