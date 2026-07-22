import type { ReactNode } from 'react';

import type {
  CondoBalance,
  DashboardSummary,
  PaidItem,
} from '@/features/dashboard/domain/dashboard';
import type { DashboardRepository } from '@/features/dashboard/domain/dashboard-repository';
import { formatBRL, formatBRLShort } from '@/shared/lib/money';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { IconBadge, SectionLabel, SurfaceCard } from '@/shared/ui/primitives';
import { TopBar } from '@/shared/ui/top-bar';

import { ResidentFinanceSkeleton } from './resident-finance-skeleton';
import { useResidentFinance } from './use-resident-finance';

type Props = {
  dashboardRepository: DashboardRepository;
  bottomNav: ReactNode;
};

export function ResidentFinanceScreen({ dashboardRepository, bottomNav }: Props) {
  const finance = useResidentFinance(dashboardRepository);

  return (
    <Screen>
      <TopBar eyebrow="Condomínio Morada · Bloco 2" title="Condomínio" />
      <ScreenBody>
        {finance.isLoading && <ResidentFinanceSkeleton />}
        {finance.isError && (
          <p style={{ color: 'var(--atraso-700)' }}>Não foi possível carregar o resumo.</p>
        )}
        {finance.isSuccess && <FinanceContent summary={finance.data} />}
      </ScreenBody>
      {bottomNav}
    </Screen>
  );
}

function FinanceContent({ summary }: { summary: DashboardSummary }) {
  return (
    <>
      <BalanceHero balance={summary.balance} />
      <SectionLabel>Últimas contas pagas</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {summary.recentPaid.map((item) => (
          <PaidRow key={item.id} item={item} />
        ))}
      </div>
    </>
  );
}

function BalanceHero({ balance }: { balance: CondoBalance }) {
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
      <div style={{ fontSize: '.82rem', color: '#A9C6C9', fontWeight: 500 }}>Saldo</div>
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
