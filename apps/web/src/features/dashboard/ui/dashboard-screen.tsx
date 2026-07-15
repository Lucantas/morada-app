import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { ensureMonthlyReceipts } from '@/app/container';
import { residentsQueryKey } from '@/features/residents/ui/use-residents';
import { formatBRL, formatBRLShort } from '@/shared/lib/money';
import { Icon } from '@/shared/ui/icon';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { IconBadge, SectionLabel, SurfaceCard } from '@/shared/ui/primitives';
import { TopBar } from '@/shared/ui/top-bar';

import type { CondoBalance, DashboardSummary, Maintenance, PaidItem } from '../domain/dashboard';
import type { DashboardRepository } from '../domain/dashboard-repository';

import { useDashboard } from './use-dashboard';

type Props = {
  repository: DashboardRepository;
  onSendNotice: () => void;
  onOpenMessages: () => void;
  onSeeAccounts: () => void;
  unreadCount: number;
  bottomNav: ReactNode;
};

export function DashboardScreen({
  repository,
  onSendNotice,
  onOpenMessages,
  onSeeAccounts,
  unreadCount,
  bottomNav,
}: Props) {
  const dashboard = useDashboard(repository);
  const [ensureError, setEnsureError] = useState(false);

  const queryClient = useQueryClient();
  useEffect(() => {
    let cancelled = false;
    void ensureMonthlyReceipts()
      .then(() => {
        if (!cancelled) void queryClient.invalidateQueries({ queryKey: residentsQueryKey });
      })
      .catch(() => {
        if (!cancelled) setEnsureError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  return (
    <Screen>
      <TopBar
        eyebrow="Condomínio Morada · Bloco 2"
        title="Painel do administrador"
        right={
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
        }
      />
      <ScreenBody>
        {ensureError && (
          <p role="status" style={{ color: 'var(--atraso-700)', fontSize: '.82rem' }}>
            Não foi possível gerar as cobranças do mês. Tente recarregar.
          </p>
        )}
        {dashboard.isLoading && <p style={{ color: 'var(--ink-500)' }}>Carregando painel…</p>}
        {dashboard.isError && (
          <p style={{ color: 'var(--atraso-700)' }}>Não foi possível carregar o painel.</p>
        )}
        {dashboard.isSuccess && (
          <DashboardContent
            summary={dashboard.data}
            onSendNotice={onSendNotice}
            onOpenMessages={onOpenMessages}
            onSeeAccounts={onSeeAccounts}
            unreadCount={unreadCount}
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
  onOpenMessages,
  onSeeAccounts,
  unreadCount,
}: {
  summary: DashboardSummary;
  onSendNotice: () => void;
  onOpenMessages: () => void;
  onSeeAccounts: () => void;
  unreadCount: number;
}) {
  return (
    <>
      <BalanceHero balance={summary.balance} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <QuickAction
          icon="bell"
          iconBg="var(--info-bg)"
          title="Enviar aviso"
          subtitle="Comunicar moradores"
          onClick={onSendNotice}
        />
        <QuickAction
          icon="message"
          title="Mensagens"
          subtitle="Recebidas dos moradores"
          onClick={onOpenMessages}
          badge={unreadCount}
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
  badge,
}: {
  icon: 'bell' | 'message';
  iconBg?: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  badge?: number;
}) {
  const showBadge = badge !== undefined && badge > 0;
  return (
    <SurfaceCard onClick={onClick} style={{ position: 'relative', padding: '14px 14px 15px' }}>
      <IconBadge icon={icon} bg={iconBg} />
      {showBadge && (
        <span
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            minWidth: 20,
            height: 20,
            padding: '0 6px',
            borderRadius: 999,
            background: 'var(--atraso-bg)',
            color: 'var(--atraso-700)',
            fontSize: '.72rem',
            fontWeight: 700,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {badge}
        </span>
      )}
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
