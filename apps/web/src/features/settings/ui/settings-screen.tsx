import { useEffect, useState } from 'react';

import { MoneyInput } from '@/shared/ui/money-input';
import { Icon } from '@/shared/ui/icon';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { Field, PrimaryButton } from '@/shared/ui/primitives';

import type { SettingsRepository } from '../domain/settings-repository';
import { useSettings, useSaveSettings } from './use-settings';

type Props = { repository: SettingsRepository; onBack: () => void };

export function SettingsScreen({ repository, onBack }: Props) {
  const settings = useSettings(repository);
  const save = useSaveSettings(repository);
  const [feeCents, setFeeCents] = useState(0);
  const [dueDay, setDueDay] = useState('15');

  useEffect(() => {
    if (settings.data) {
      setFeeCents(settings.data.monthlyFeeCents);
      setDueDay(String(settings.data.dueDay));
    }
  }, [settings.data]);

  const submit = () => {
    const day = Number.parseInt(dueDay, 10);
    save.mutate(
      { monthlyFeeCents: feeCents, dueDay: Number.isFinite(day) ? day : 15 },
      { onSuccess: onBack },
    );
  };

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
        <div className="fraunces" style={{ fontSize: '1.35rem', fontWeight: 600 }}>
          Configurações
        </div>
      </div>
      <ScreenBody>
        {settings.isLoading && <p style={{ color: 'var(--ink-500)' }}>Carregando…</p>}
        {settings.isError && (
          <p style={{ color: 'var(--atraso-700)' }}>Não foi possível carregar as configurações.</p>
        )}
        {settings.isSuccess && (
          <div style={{ paddingTop: 2 }}>
            <MoneyInput label="Valor da taxa" value={feeCents} onChange={setFeeCents} />
            <Field label="Dia de vencimento" value={dueDay} onChange={setDueDay} type="number" />
            <PrimaryButton icon="check" onClick={submit}>
              Salvar
            </PrimaryButton>
          </div>
        )}
      </ScreenBody>
    </Screen>
  );
}
