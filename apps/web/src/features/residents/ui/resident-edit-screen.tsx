import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Icon } from '@/shared/ui/icon';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { Field, PrimaryButton } from '@/shared/ui/primitives';

import { getResident } from '../domain/get-resident';
import type { ResidentStatus } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';

import { residentStatusView } from './resident-status-view';
import { residentsQueryKey, useSaveResident } from './use-residents';

const STATUSES: ResidentStatus[] = ['em_dia', 'pendente', 'atrasado'];
const EMPTY = { name: '', apt: '', phone: '', email: '', status: 'em_dia' as ResidentStatus };

type Props = {
  repository: ResidentRepository;
  residentId?: string;
  onBack: () => void;
  onCreateLogin?: () => void;
};

export function ResidentEditScreen({ repository, residentId, onBack, onCreateLogin }: Props) {
  const existing = useQuery({
    queryKey: [...residentsQueryKey, residentId],
    queryFn: () => getResident(repository, residentId as string),
    enabled: residentId !== undefined,
  });
  const save = useSaveResident(repository);
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (existing.data) {
      const { name, apt, phone, email, status } = existing.data;
      setForm({ name, apt, phone, email, status });
    }
  }, [existing.data]);

  const set = (key: keyof typeof EMPTY) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    save.mutate({ ...form, id: residentId }, { onSuccess: onBack });
  };

  const title = residentId ? (existing.data?.name ?? 'Editar morador') : 'Novo morador';

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
            Moradores · Bloco 2
          </div>
          <div className="fraunces" style={{ fontSize: '1.35rem', fontWeight: 600, color: '#fff' }}>
            {title}
          </div>
        </div>
      </div>
      <ScreenBody>
        <div style={{ paddingTop: 2 }}>
          <Field
            label="Nome completo"
            value={form.name}
            onChange={set('name')}
            placeholder="Ex.: Maria Ribeiro"
          />
          <Field
            label="Apartamento"
            value={form.apt}
            onChange={set('apt')}
            placeholder="Ex.: Apto 302"
          />
          <Field
            label="Telefone"
            value={form.phone}
            onChange={set('phone')}
            placeholder="(11) 90000-0000"
          />
          <Field
            label="E-mail"
            value={form.email}
            onChange={set('email')}
            placeholder="morador@email.com"
            type="email"
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
              const view = residentStatusView(status);
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
            {residentId ? 'Salvar alterações' : 'Cadastrar morador'}
          </PrimaryButton>

          {onCreateLogin && (
            <button
              type="button"
              onClick={onCreateLogin}
              style={{
                width: '100%',
                minHeight: 50,
                marginTop: 12,
                borderRadius: 'var(--r-md)',
                border: '1.5px solid var(--petrol-600)',
                background: 'var(--surface)',
                color: 'var(--petrol-800)',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: '1rem',
                cursor: 'pointer',
              }}
            >
              Criar acesso do morador
            </button>
          )}
        </div>
      </ScreenBody>
    </Screen>
  );
}
