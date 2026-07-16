import { formatBRL } from '@/shared/lib/money';
import { EmptyState } from '@/shared/ui/empty-state';
import { Icon } from '@/shared/ui/icon';
import { IconBadge, SectionLabel, SurfaceCard } from '@/shared/ui/primitives';
import { StatusView } from '@/shared/ui/status-view';

import type { Income } from '../domain/income';
import type { IncomeRepository } from '../domain/income-repository';

import { useIncomes } from './use-income';

type Props = {
  repository: IncomeRepository;
  onOpenIncome: (id?: string) => void;
};

export function IncomeSection({ repository, onOpenIncome }: Props) {
  const incomes = useIncomes(repository);

  return (
    <>
      <SectionLabel right={<AddIncomeButton onClick={() => onOpenIncome()} />}>
        Outras entradas
      </SectionLabel>
      {incomes.isLoading && <StatusView variant="loading" message="Carregando entradas…" />}
      {incomes.isError && (
        <StatusView variant="error" message="Não foi possível carregar as entradas." />
      )}
      {incomes.isSuccess && incomes.data.length === 0 && (
        <EmptyState icon="bank" title="Nenhuma entrada registrada" />
      )}
      {incomes.isSuccess && incomes.data.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {incomes.data.map((income) => (
            <IncomeRow key={income.id} income={income} onClick={() => onOpenIncome(income.id)} />
          ))}
        </div>
      )}
    </>
  );
}

function AddIncomeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Adicionar"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        border: 'none',
        background: 'transparent',
        color: 'var(--petrol-600)',
        fontWeight: 700,
        fontSize: '.82rem',
        letterSpacing: '.04em',
        textTransform: 'uppercase',
        cursor: 'pointer',
      }}
    >
      <Icon name="plus" size={16} strokeWidth={2.4} />
      Adicionar
    </button>
  );
}

function IncomeRow({ income, onClick }: { income: Income; onClick: () => void }) {
  return (
    <SurfaceCard
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 14px' }}
    >
      <IconBadge icon="bank" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '1rem' }}>{income.description}</div>
        <div style={{ fontSize: '.86rem', color: 'var(--ink-500)' }}>{income.source}</div>
      </div>
      <div className="fraunces" style={{ fontWeight: 700, fontSize: '1.05rem' }}>
        R$ {formatBRL(income.valueCents)}
      </div>
    </SurfaceCard>
  );
}
