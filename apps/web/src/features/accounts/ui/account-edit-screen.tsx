import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { formatBRL } from '@/shared/lib/money';
import { Icon } from '@/shared/ui/icon';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { Field, PrimaryButton } from '@/shared/ui/primitives';

import type { AccountStatus } from '../domain/account';
import type { AccountRepository } from '../domain/account-repository';
import { getAccount } from '../domain/get-account';
import { parseReaisToCents } from '../domain/parse-reais-to-cents';

import { accountStatusView } from './account-status-view';
import { accountsQueryKey, useSaveAccount } from './use-accounts';

const STATUSES: AccountStatus[] = ['pago', 'pendente', 'atrasado'];
const EMPTY = {
  description: '',
  category: '',
  date: '',
  value: '',
  status: 'pendente' as AccountStatus,
};

type Props = {
  repository: AccountRepository;
  accountId?: string;
  onBack: () => void;
};

export function AccountEditScreen({ repository, accountId, onBack }: Props) {
  const existing = useQuery({
    queryKey: [...accountsQueryKey, accountId],
    queryFn: () => getAccount(repository, accountId as string),
    enabled: accountId !== undefined,
  });
  const save = useSaveAccount(repository);
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (existing.data) {
      const { description, category, date, valueCents, status } = existing.data;
      setForm({ description, category, date: date ?? '', value: formatBRL(valueCents), status });
    }
  }, [existing.data]);

  const set = (key: keyof typeof EMPTY) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    const { value, date, ...rest } = form;
    save.mutate(
      {
        ...rest,
        date: date === '' ? null : date,
        valueCents: parseReaisToCents(value),
        id: accountId,
      },
      { onSuccess: onBack },
    );
  };

  const title = accountId ? (existing.data?.description ?? 'Editar conta') : 'Nova conta';

  return (
    <Screen>
      <div
        style={{
          background: 'var(--petrol-800)',
          color: '#fff',
          padding: '18px 18px 20px',
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={onBack}
          aria-label="Voltar"
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            background: 'rgba(255,255,255,.12)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            border: 'none',
            flex: 'none',
          }}
        >
          <Icon name="chevronLeft" color="#fff" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '.78rem', color: '#A9C6C9', fontWeight: 500 }}>
            Contas · Bloco 2
          </div>
          <div className="fraunces" style={{ fontSize: '1.35rem', fontWeight: 600, color: '#fff' }}>
            {title}
          </div>
        </div>
      </div>
      <ScreenBody>
        <div style={{ paddingTop: 2 }}>
          <Field
            label="Descrição"
            value={form.description}
            onChange={set('description')}
            placeholder="Ex.: Água — abril"
          />
          <Field
            label="Categoria"
            value={form.category}
            onChange={set('category')}
            placeholder="Ex.: Utilidades"
          />
          <Field label="Data" value={form.date} onChange={set('date')} type="date" />
          <Field
            label="Valor (R$)"
            value={form.value}
            onChange={set('value')}
            placeholder="Ex.: 1.240,00"
          />

          <label
            style={{
              display: 'block',
              fontWeight: 600,
              fontSize: '.9rem',
              marginBottom: 9,
              color: 'var(--ink-900)',
            }}
          >
            Situação
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {STATUSES.map((status) => {
              const view = accountStatusView(status);
              const active = form.status === status;
              return (
                <button
                  key={status}
                  onClick={() => setForm((prev) => ({ ...prev, status }))}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    borderRadius: 'var(--r-sm)',
                    border: `1.5px solid ${active ? 'var(--petrol-600)' : 'var(--line)'}`,
                    background: active ? 'var(--petrol-50)' : 'var(--surface)',
                    color: active ? 'var(--petrol-800)' : 'var(--ink-500)',
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 600,
                    fontSize: '.86rem',
                    cursor: 'pointer',
                  }}
                >
                  {view.label}
                </button>
              );
            })}
          </div>

          <PrimaryButton icon="check" onClick={submit}>
            {accountId ? 'Salvar alterações' : 'Registrar conta'}
          </PrimaryButton>
        </div>
      </ScreenBody>
    </Screen>
  );
}
