import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { formatBRL, formatBRLShort } from '@/shared/lib/money';
import { Icon } from '@/shared/ui/icon';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { IconBadge, SectionLabel, SurfaceCard } from '@/shared/ui/primitives';
import { TopBar } from '@/shared/ui/top-bar';

import type { CondoBalance, DashboardSummary, Maintenance, PaidItem } from '../domain/dashboard';
import type { DashboardRepository } from '../domain/dashboard-repository';

import { useDashboard } from './use-dashboard';
import { DashboardSkeleton } from './dashboard-skeleton';

type Props = {
  repository: DashboardRepository;
  onSendNotice: () => void;
  onSeeAccounts: () => void;
  onOpenSettings?: () => void;
  bottomNav: ReactNode;
  ensureMonthlyReceipts?: () => Promise<void>;
};

export function DashboardScreen({
  repository,
  onSendNotice,
  onSeeAccounts,
  onOpenSettings,
  bottomNav,
  ensureMonthlyReceipts,
}: Props) {
  const dashboard = useDashboard(repository);
  const [ensureError, setEnsureError] = useState(false);

  useEffect(() => {
    if (!ensureMonthlyReceipts) return;
    let cancelled = false;
    void ensureMonthlyReceipts().catch(() => {
      if (!cancelled) setEnsureError(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ensureMonthlyReceipts]);

  return (
    <Screen>
      <TopBar
        eyebrow="Condomínio Morada · Bloco 2"
        title="Painel do administrador"
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(255,255,255,.12)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Icon name="bell" size={19} color="#fff" />
            </div>
            <button
              type="button"
              aria-label="Ajustes"
              onClick={onOpenSettings}
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
              <Icon name="wrench" size={19} color="#fff" />
            </button>
          </div>
        }
      />
      <ScreenBody>
        {ensureError && (
          <p role="status" style={{ color: 'var(--atraso-700)', fontSize: '.82rem' }}>
            Não foi possível gerar as cobranças do mês. Tente recarregar.
          </p>
        )}
        {dashboard.isLoading && <DashboardSkeleton />}
        {dashboard.isError && (
          <p style={{ color: 'var(--atraso-700)' }}>Não foi possível carregar o painel.</p>
        )}
        {dashboard.isSuccess && (
          <DashboardContent
            summary={dashboard.data}
            onSendNotice={onSendNotice}
            onSeeAccounts={onSeeAccounts}
          />
        )}
      </ScreenBody>
      {bottomNav}
    </Screen>
  );
}

function DashboardContent({
  summary,
  onSendNotice,
  onSeeAccounts,
}: {
  summary: DashboardSummary;
  onSendNotice: () => void;
  onSeeAccounts: () => void;
}) {
  return (
    <>
      <BalanceHero balance={summary.balance} />
      <div style={{ marginTop: 12 }}>
        <QuickAction
          icon="bell"
          iconBg="var(--info-bg)"
          title="Enviar aviso"
          subtitle="Comunicar moradores"
          onClick={onSendNotice}
        />
      </div>

      <SectionLabel
        right={
          <button
            type="button"
            onClick={onSeeAccounts}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--petrol-600)',
              fontWeight: 600,
              fontSize: '.78rem',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Ver todas
          </button>
        }
      >
        Últimas contas pagas
      </SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {summary.recentPaid.map((item) => (
          <PaidRow key={item.id} item={item} />
        ))}
      </div>

      <SectionLabel>Últimas manutenções</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {summary.maintenances.map((maintenance) => (
          <MaintenanceRow key={maintenance.id} maintenance={maintenance} />
        ))}
      </div>
    </>
  );
}

function BalanceHero({ balance }: { balance: CondoBalance }) {
  return (
    <SurfaceCard
      style={{
        position: 'relative',
        background: 'linear-gradient(135deg, var(--petrol-700), var(--petrol-800))',
        border: 'none',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--sh-2)',
        color: '#fff',
        padding: '18px 18px 20px',
      }}
    >
      <div style={{ fontSize: '.82rem', color: '#A9C6C9', fontWeight: 500 }}>
        Saldo do condomínio
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
        <span>{formatBRL(balance.balanceCents)}</span>
      </div>
      <div style={{ display: 'flex', gap: 20, marginTop: 16 }}>
        <div>
          <div style={{ fontSize: '.72rem', color: '#A9C6C9' }}>Entradas do mês</div>
          <div style={{ fontWeight: 600, fontSize: '.95rem', marginTop: 2 }}>
            {formatBRL(balance.incomeCents)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '.72rem', color: '#A9C6C9' }}>Contas pagas do mês</div>
          <div style={{ fontWeight: 600, fontSize: '.95rem', marginTop: 2 }}>
            {formatBRL(balance.paidCents)}
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}

function QuickAction({
  icon,
  iconBg,
  title,
  subtitle,
  onClick,
}: {
  icon: 'bell';
  iconBg?: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <SurfaceCard onClick={onClick} style={{ position: 'relative', padding: '14px 14px 15px' }}>
      <IconBadge icon={icon} bg={iconBg} />
      <div style={{ fontWeight: 600, fontSize: '.98rem', marginTop: 11 }}>{title}</div>
      <div style={{ fontSize: '.78rem', color: 'var(--ink-500)', marginTop: 1 }}>{subtitle}</div>
    </SurfaceCard>
  );
}

function PaidRow({ item }: { item: PaidItem }) {
  return (
    <SurfaceCard style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 14px' }}>
      <IconBadge icon={item.icon} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '.96rem' }}>{item.label}</div>
        <div style={{ fontSize: '.82rem', color: 'var(--ink-500)' }}>{item.dateLabel}</div>
      </div>
      <div className="fraunces" style={{ fontWeight: 600, color: 'var(--petrol-900)' }}>
        {'R$ ' + formatBRLShort(item.valueCents)}
      </div>
    </SurfaceCard>
  );
}

function MaintenanceRow({ maintenance }: { maintenance: Maintenance }) {
  return (
    <SurfaceCard style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 14px' }}>
      <IconBadge icon={maintenance.icon} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '.96rem' }}>{maintenance.title}</div>
        <div style={{ fontSize: '.82rem', color: 'var(--ink-500)' }}>{maintenance.detail}</div>
      </div>
    </SurfaceCard>
  );
}
