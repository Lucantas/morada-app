import { useId, useState, type ReactNode } from 'react';

import { FormError } from '@/shared/ui/entry-layout';
import { MoneyInput } from '@/shared/ui/money-input';
import { Field, PrimaryButton } from '@/shared/ui/primitives';

import {
  addCategory,
  selectedCategories,
  setCategorySpend,
  toggleCategory,
  type CashMode,
  type GroundForm,
  type SpendMode,
} from '../domain/ground-form';

import { Chip, ChipRow } from './composer';

type Props = { form: GroundForm; onChange: (form: GroundForm) => void };

const LATER = 'Depois eu vejo';

function GroundCard({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <div
      role="group"
      aria-labelledby={titleId}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        padding: 14,
        display: 'grid',
        gap: 12,
      }}
    >
      <strong id={titleId} style={{ fontFamily: "'Fraunces', serif", fontSize: '1rem' }}>
        {title}
      </strong>
      {children}
    </div>
  );
}

function OtherCategory({ form, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return <Chip onClick={() => setOpen(true)}>+ Outra</Chip>;

  const add = () => {
    const result = addCategory(form, name);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    onChange(result.form);
    setName('');
    setError(null);
    setOpen(false);
  };

  return (
    <div style={{ width: '100%' }}>
      <Field label="Outra conta" value={name} onChange={setName} autoComplete="off" />
      <FormError message={error} />
      <PrimaryButton onClick={add}>Adicionar</PrimaryButton>
    </div>
  );
}

function CategoriesCard({ form, onChange }: Props) {
  return (
    <GroundCard title="Contas">
      <ChipRow>
        {form.options.map((name) => (
          <Chip
            key={name}
            pressed={form.selected.includes(name)}
            onClick={() => onChange(toggleCategory(form, name))}
          >
            {name}
          </Chip>
        ))}
        <OtherCategory form={form} onChange={onChange} />
      </ChipRow>
    </GroundCard>
  );
}

function SpendCard({ form, onChange }: Props) {
  const setMode = (mode: SpendMode) =>
    onChange({ ...form, spendMode: form.spendMode === mode ? 'byCategory' : mode });
  return (
    <GroundCard title="Gasto no mês">
      <ChipRow>
        <Chip pressed={form.spendMode === 'total'} onClick={() => setMode('total')}>
          Só sei o total
        </Chip>
        <Chip pressed={form.spendMode === 'later'} onClick={() => setMode('later')}>
          {LATER}
        </Chip>
      </ChipRow>
      {form.spendMode === 'total' && (
        <MoneyInput
          label="Total do mês"
          value={form.totalCents}
          onChange={(cents) => onChange({ ...form, totalCents: cents })}
        />
      )}
      {form.spendMode === 'byCategory' &&
        selectedCategories(form).map((name) => (
          <MoneyInput
            key={name}
            label={name}
            value={form.perCategory[name] ?? 0}
            onChange={(cents) => onChange(setCategorySpend(form, name, cents))}
          />
        ))}
    </GroundCard>
  );
}

function CashCard({ form, onChange }: Props) {
  const setMode = (mode: CashMode) =>
    onChange({ ...form, cashMode: form.cashMode === mode ? 'value' : mode });
  return (
    <GroundCard title="Em caixa hoje">
      <ChipRow>
        <Chip pressed={form.cashMode === 'empty'} onClick={() => setMode('empty')}>
          Está vazio
        </Chip>
        <Chip pressed={form.cashMode === 'later'} onClick={() => setMode('later')}>
          {LATER}
        </Chip>
      </ChipRow>
      {form.cashMode === 'value' && (
        <MoneyInput
          label="Valor em caixa"
          value={form.cashCents}
          onChange={(cents) => onChange({ ...form, cashCents: cents })}
        />
      )}
    </GroundCard>
  );
}

export function GroundStep({ form, onChange }: Props) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <CategoriesCard form={form} onChange={onChange} />
      <SpendCard form={form} onChange={onChange} />
      <CashCard form={form} onChange={onChange} />
    </div>
  );
}
