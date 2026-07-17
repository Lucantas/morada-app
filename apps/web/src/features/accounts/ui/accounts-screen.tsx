import type { ReactNode } from 'react';
import { useState } from 'react';

import { formatIsoDate } from '@/shared/lib/dates';
import { formatBRL } from '@/shared/lib/money';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { IconBadge, PrimaryButton, SectionLabel, SurfaceCard } from '@/shared/ui/primitives';
import { StatusPill } from '@/shared/ui/status-pill';
import { TopBar } from '@/shared/ui/top-bar';

import type { Account } from '../domain/account';
import type { AccountRepository } from '../domain/account-repository';
import { accountTotals } from '../domain/account-totals';
import { filterAccounts, type AccountFilters } from '../domain/filter-accounts';

import { accountStatusView } from './account-status-view';
import { useAccounts } from './use-accounts';

const emptyFilters: AccountFilters = { query: '', category: '', from: '', to: '' };

type Props = {
  repository: AccountRepository;
  onOpenAccount: (id?: string) => void;
  incomeSection: ReactNode;
  bottomNav: ReactNode;
};

export function AccountsScreen({ repository, onOpenAccount, incomeSection, bottomNav }: Props) {
  const accounts = useAccounts(repository);
  const totals = accountTotals(accounts.data ?? []);
  const [filters, setFilters] = useState<AccountFilters>(emptyFilters);

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
          <AccountsContent
            accounts={accounts.data}
            onOpenAccount={onOpenAccount}
            filters={filters}
            onFiltersChange={setFilters}
          />
        )}
        {incomeSection}
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
  filters,
  onFiltersChange,
}: {
  accounts: Account[];
  onOpenAccount: (id?: string) => void;
  filters: AccountFilters;
  onFiltersChange: (filters: AccountFilters) => void;
}) {
  const categories = Array.from(new Set(accounts.map((account) => account.category))).sort();
  const filtered = filterAccounts(accounts, filters);

  return (
    <>
      <div style={{ marginTop: 4 }}>
        <PrimaryButton icon="plus" onClick={() => onOpenAccount()}>
          Registrar nova conta
        </PrimaryButton>
      </div>
      <FilterBar filters={filters} categories={categories} onFiltersChange={onFiltersChange} />
      <SectionLabel>Lançamentos · abril</SectionLabel>
      {filtered.length === 0 ? (
        <p style={{ color: 'var(--ink-500)' }}>Nenhum lançamento encontrado.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              onClick={() => onOpenAccount(account.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function FilterBar({
  filters,
  categories,
  onFiltersChange,
}: {
  filters: AccountFilters;
  categories: string[];
  onFiltersChange: (filters: AccountFilters) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '10px 0' }}>
      <input
        type="text"
        aria-label="Buscar por nome"
        placeholder="Buscar por nome"
        value={filters.query}
        onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
        style={{
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid var(--ink-200, #d9d9d9)',
        }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <select
          aria-label="Categoria"
          value={filters.category}
          onChange={(event) => onFiltersChange({ ...filters, category: event.target.value })}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid var(--ink-200, #d9d9d9)',
          }}
        >
          <option value="">Todas</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="date"
          aria-label="De"
          value={filters.from}
          onChange={(event) => onFiltersChange({ ...filters, from: event.target.value })}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid var(--ink-200, #d9d9d9)',
          }}
        />
        <input
          type="date"
          aria-label="Até"
          value={filters.to}
          onChange={(event) => onFiltersChange({ ...filters, to: event.target.value })}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid var(--ink-200, #d9d9d9)',
          }}
        />
      </div>
    </div>
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
          {account.category}
          {account.date ? ` · ${formatIsoDate(account.date)}` : ''}
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
