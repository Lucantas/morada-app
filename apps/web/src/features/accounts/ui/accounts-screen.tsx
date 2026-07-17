import type { ReactNode } from 'react';
import { useState } from 'react';

import { formatIsoDate, formatMonthName } from '@/shared/lib/dates';
import { formatBRL } from '@/shared/lib/money';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { DateInput } from '@/shared/ui/date-input';
import { Icon } from '@/shared/ui/icon';
import { IconBadge, PrimaryButton, SectionLabel, SurfaceCard } from '@/shared/ui/primitives';
import { StatusPill } from '@/shared/ui/status-pill';
import { TopBar } from '@/shared/ui/top-bar';

import type { Account } from '../domain/account';
import type { AccountRepository } from '../domain/account-repository';
import { accountMonths, monthlyExpenseCents, resolveSelectedMonth } from '../domain/account-totals';
import { activeFilterCount, filterAccounts, type AccountFilters } from '../domain/filter-accounts';

import { accountStatusView } from './account-status-view';
import { useAccounts } from './use-accounts';

const emptyFilters: AccountFilters = { query: '', category: '', from: '', to: '' };

type Props = {
  repository: AccountRepository;
  onOpenAccount: (id?: string) => void;
  incomeSection: ReactNode;
  bottomNav: ReactNode;
  monthlyIncomeCents: Record<string, number>;
};

function uniqueSortedUnion(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b])).sort();
}

export function AccountsScreen({
  repository,
  onOpenAccount,
  incomeSection,
  bottomNav,
  monthlyIncomeCents,
}: Props) {
  const accounts = useAccounts(repository);
  const [filters, setFilters] = useState<AccountFilters>(emptyFilters);

  const data = accounts.data ?? [];
  const months = uniqueSortedUnion(accountMonths(data), Object.keys(monthlyIncomeCents));
  const [monthOverride, setMonthOverride] = useState<string | null>(null);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const selectedMonth = resolveSelectedMonth(monthOverride, months, currentMonth);
  const monthIndex = months.indexOf(selectedMonth);

  const entradas = monthlyIncomeCents[selectedMonth] ?? 0;
  const saidas = monthlyExpenseCents(data, selectedMonth);

  const canGoPrevious = monthIndex > 0;
  const canGoNext = monthIndex >= 0 && monthIndex < months.length - 1;

  const goToPreviousMonth = () => {
    if (!canGoPrevious) return;
    setMonthOverride(months[monthIndex - 1] ?? null);
  };

  const goToNextMonth = () => {
    if (!canGoNext) return;
    setMonthOverride(months[monthIndex + 1] ?? null);
  };

  return (
    <Screen>
      <TopBar eyebrow="Condomínio Morada · Bloco 2" title="Contas">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 5,
          }}
        >
          <div style={{ fontSize: '.82rem', color: '#9FC0C3', fontWeight: 400 }}>
            resumo do mês de{' '}
            <span style={{ textTransform: 'capitalize', color: '#CFE3E4', fontWeight: 500 }}>
              {formatMonthName(selectedMonth)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <MonthStepButton
              direction="previous"
              disabled={!canGoPrevious}
              onClick={goToPreviousMonth}
            />
            <MonthStepButton direction="next" disabled={!canGoNext} onClick={goToNextMonth} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
          <HeaderTile
            label="Entradas"
            value={formatBRL(entradas)}
            prefix="+R$"
            valueColor="var(--pago-bg)"
          />
          <HeaderTile label="Saídas" value={formatBRL(saidas)} prefix="R$" />
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

function MonthStepButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'previous' | 'next';
  disabled: boolean;
  onClick: () => void;
}) {
  const label = direction === 'previous' ? 'Mês anterior' : 'Próximo mês';
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) onClick();
      }}
      style={{
        width: 28,
        height: 28,
        borderRadius: 9,
        border: 'none',
        background: 'rgba(255,255,255,.1)',
        display: 'grid',
        placeItems: 'center',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        color: '#fff',
      }}
    >
      <Icon name={direction === 'previous' ? 'chevronLeft' : 'chevronRight'} size={16} />
    </button>
  );
}

function HeaderTile({
  label,
  value,
  prefix,
  valueColor,
}: {
  label: string;
  value: string;
  prefix: string;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        background: 'rgba(255,255,255,.08)',
        borderRadius: 12,
        padding: '12px 14px',
      }}
    >
      <div style={{ fontSize: '.74rem', color: '#B9D2D4' }}>{label}</div>
      <div
        className="fraunces"
        style={{
          fontWeight: 700,
          fontSize: '1.3rem',
          fontVariantNumeric: 'tabular-nums',
          marginTop: 2,
          color: valueColor ?? '#fff',
        }}
      >
        <span style={{ fontSize: '.6em', color: '#9FC0C3', marginRight: 2 }}>{prefix}</span>
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
      <FilterPanel filters={filters} categories={categories} onFiltersChange={onFiltersChange} />
      <SectionLabel
        right={<span style={{ fontWeight: 600, color: 'var(--ink-300)' }}>{filtered.length}</span>}
      >
        Lançamentos
      </SectionLabel>
      {filtered.length === 0 ? (
        <div
          style={{
            padding: '22px 16px',
            textAlign: 'center',
            background: 'var(--surface)',
            border: '1px dashed var(--line)',
            borderRadius: 'var(--r-md)',
            fontSize: '.88rem',
            color: 'var(--ink-500)',
          }}
        >
          Nenhum lançamento encontrado com esses filtros.
        </div>
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

function FilterPanel({
  filters,
  categories,
  onFiltersChange,
}: {
  filters: AccountFilters;
  categories: string[];
  onFiltersChange: (filters: AccountFilters) => void;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const count = activeFilterCount(filters);

  return (
    <div style={{ marginTop: 14 }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={filterOpen}
        onClick={() => setFilterOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setFilterOpen((open) => !open);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-md)',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Icon name="search" size={17} color="var(--ink-500)" />
          <span style={{ fontWeight: 600, fontSize: '.9rem', color: 'var(--ink-900)' }}>
            Filtrar lançamentos
          </span>
          {count > 0 && (
            <span
              style={{
                minWidth: 18,
                height: 18,
                padding: '0 5px',
                borderRadius: 999,
                background: 'var(--petrol-700)',
                color: '#fff',
                fontSize: '.68rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {count}
            </span>
          )}
        </div>
        <Icon
          name="chevronRight"
          size={16}
          color="var(--ink-500)"
          style={{ transform: filterOpen ? 'rotate(90deg)' : 'none' }}
        />
      </div>
      {filterOpen && (
        <div
          style={{
            marginTop: 8,
            padding: 14,
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: 13,
          }}
        >
          <input
            type="text"
            aria-label="Buscar por nome"
            placeholder="Buscar por nome…"
            value={filters.query}
            onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--line)',
              fontFamily: "'Inter', sans-serif",
              fontSize: '1rem',
            }}
          />
          <CategoryGroup
            filters={filters}
            categories={categories}
            onFiltersChange={onFiltersChange}
          />
          <div>
            <GroupLabel>Período</GroupLabel>
            <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <DateInput
                  label="De"
                  value={filters.from}
                  onChange={(v) => onFiltersChange({ ...filters, from: v })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <DateInput
                  label="Até"
                  value={filters.to}
                  onChange={(v) => onFiltersChange({ ...filters, to: v })}
                />
              </div>
            </div>
          </div>
          {count > 0 && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => onFiltersChange(emptyFilters)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onFiltersChange(emptyFilters);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: 'var(--petrol-700)',
                fontWeight: 600,
                fontSize: '.86rem',
                cursor: 'pointer',
              }}
            >
              <Icon name="x" size={15} />
              Limpar filtros
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: '.74rem',
        fontWeight: 700,
        letterSpacing: '.03em',
        textTransform: 'uppercase',
        color: 'var(--ink-500)',
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function CategoryGroup({
  filters,
  categories,
  onFiltersChange,
}: {
  filters: AccountFilters;
  categories: string[];
  onFiltersChange: (filters: AccountFilters) => void;
}) {
  return (
    <div>
      <GroupLabel>Categoria</GroupLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        <CategoryChip
          label="Todas"
          active={filters.category === ''}
          onClick={() => onFiltersChange({ ...filters, category: '' })}
        />
        {categories.map((category) => (
          <CategoryChip
            key={category}
            label={category}
            active={filters.category === category}
            onClick={() => onFiltersChange({ ...filters, category })}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '7px 13px',
        borderRadius: 999,
        border: `1.5px solid ${active ? 'var(--petrol-600)' : 'var(--line)'}`,
        fontWeight: 600,
        fontSize: '.84rem',
        cursor: 'pointer',
        background: active ? 'var(--petrol-600)' : 'var(--surface-2, #FBF8F1)',
        color: active ? '#fff' : 'var(--ink-700)',
      }}
    >
      {label}
    </button>
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
