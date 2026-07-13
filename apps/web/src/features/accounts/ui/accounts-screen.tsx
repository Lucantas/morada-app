import type { ReactNode } from 'react';

import { formatBRL } from '@/shared/lib/money';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { IconBadge, PrimaryButton, SectionLabel, SurfaceCard } from '@/shared/ui/primitives';
import { StatusPill } from '@/shared/ui/status-pill';
import { TopBar } from '@/shared/ui/top-bar';

import type { Account } from '../domain/account';
import type { AccountRepository } from '../domain/account-repository';
import { accountTotals } from '../domain/account-totals';

import { accountStatusView } from './account-status-view';
import { useAccounts } from './use-accounts';

type Props = {
  repository: AccountRepository;
  onOpenAccount: (id?: string) => void;
  bottomNav: ReactNode;
};

export function AccountsScreen({ repository, onOpenAccount, bottomNav }: Props) {
  const accounts = useAccounts(repository);
  const totals = accountTotals(accounts.data ?? []);

  return (
    <Screen>
      <TopBar eyebrow="Condomínio Morada · Bloco 2" title="Contas">
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <HeaderTile label="Pago no mês" value={formatBRL(totals.paidCents)} />
          <HeaderTile label="A pagar" value={formatBRL(totals.dueCents)} />
        </div>
      </TopBar>
      <ScreenBody>
        {accounts.isLoading && <p style={{ color: 'var(--ink-500)' }}>Carregando contas…</p>}
        {accounts.isError && (
          <p style={{ color: 'var(--atraso-700)' }}>Não foi possível carregar as contas.</p>
        )}
        {accounts.isSuccess && (
          <AccountsContent accounts={accounts.data} onOpenAccount={onOpenAccount} />
        )}
      </ScreenBody>
      {bottomNav}
    </Screen>
  );
}

function HeaderTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: 1,
        background: 'rgba(255,255,255,.08)',
        borderRadius: 12,
        padding: '12px 14px',
      }}
    >
      <div style={{ fontSize: '.72rem', color: '#A9C6C9', fontWeight: 500 }}>{label}</div>
      <div className="fraunces" style={{ fontSize: '1.3rem', fontWeight: 600, color: '#fff' }}>
        {value}
      </div>
    </div>
  );
}

function AccountsContent({
  accounts,
  onOpenAccount,
}: {
  accounts: Account[];
  onOpenAccount: (id?: string) => void;
}) {
  return (
    <>
      <div style={{ marginTop: 4 }}>
        <PrimaryButton icon="plus" onClick={() => onOpenAccount()}>
          Registrar nova conta
        </PrimaryButton>
      </div>
      <SectionLabel>Lançamentos · abril</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {accounts.map((account) => (
          <AccountRow
            key={account.id}
            account={account}
            onClick={() => onOpenAccount(account.id)}
          />
        ))}
      </div>
    </>
  );
}

function AccountRow({ account, onClick }: { account: Account; onClick: () => void }) {
  const view = accountStatusView(account.status);
  return (
    <SurfaceCard
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 14px' }}
    >
      <IconBadge icon="receipt" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '1rem' }}>{account.description}</div>
        <div style={{ fontSize: '.86rem', color: 'var(--ink-500)' }}>
          {account.category} · {account.dateLabel}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <div className="fraunces" style={{ fontWeight: 700, fontSize: '1.05rem' }}>
          R$ {formatBRL(account.valueCents)}
        </div>
        <StatusPill tone={view.tone} label={view.label} size="sm" />
      </div>
    </SurfaceCard>
  );
}
