import { useEffect, useState, type ChangeEvent } from 'react';

import { Icon } from '@/shared/ui/icon';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { Field, PrimaryButton } from '@/shared/ui/primitives';
import { MoneyInput } from '@/shared/ui/money-input';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { fileToDataUrl, isAllowedProof } from '@/features/receipts/domain/proof';

import type { IncomeRepository } from '../domain/income-repository';
import { useDeleteIncome, useIncomes, useSaveIncome } from './use-income';

const EMPTY = {
  description: '',
  source: '',
  date: '',
  valueCents: 0,
  proofDataUrl: undefined as string | undefined,
};

type Props = {
  incomeId?: string;
  repository: IncomeRepository;
  onBack: () => void;
};

export function IncomeEditScreen({ incomeId, repository, onBack }: Props) {
  const incomes = useIncomes(repository);
  const existing = incomes.data?.find((income) => income.id === incomeId);
  const save = useSaveIncome(repository);
  const deleteIncome = useDeleteIncome(repository);
  const [form, setForm] = useState(EMPTY);
  const [proofName, setProofName] = useState<string | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (existing) {
      const { description, source, date, valueCents, proofDataUrl } = existing;
      setForm({ description, source, date: date ?? '', valueCents, proofDataUrl });
    }
  }, [existing]);

  const set = (key: 'description' | 'source' | 'date') => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleProofChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    if (!isAllowedProof(dataUrl)) {
      setProofError('Envie uma imagem ou PDF do comprovante.');
      return;
    }
    setForm((prev) => ({ ...prev, proofDataUrl: dataUrl }));
    setProofName(file.name);
    setProofError(null);
  };

  const submit = () => {
    if (form.description.trim() === '' || form.source.trim() === '' || form.valueCents <= 0) {
      setValidationError('Preencha descrição, origem e um valor maior que zero.');
      return;
    }
    setValidationError(null);
    save.mutate(
      {
        id: incomeId,
        description: form.description,
        source: form.source,
        date: form.date === '' ? null : form.date,
        valueCents: form.valueCents,
        proofDataUrl: form.proofDataUrl,
      },
      { onSuccess: onBack },
    );
  };

  const title = incomeId ? 'Editar entrada' : 'Nova entrada';

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
            Contas · Outras entradas
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
            placeholder="Ex.: Aluguel salão de festas"
          />
          <Field
            label="Origem"
            value={form.source}
            onChange={set('source')}
            placeholder="Ex.: Salão de festas"
          />
          <MoneyInput
            label="Valor"
            value={form.valueCents}
            onChange={(cents) => setForm((prev) => ({ ...prev, valueCents: cents }))}
          />
          <Field label="Data" value={form.date} onChange={set('date')} type="date" />

          <label
            htmlFor="income-proof"
            style={{
              display: 'block',
              fontWeight: 600,
              fontSize: '.9rem',
              marginBottom: 9,
              color: 'var(--ink-900)',
            }}
          >
            Anexar comprovante
          </label>
          <input
            id="income-proof"
            type="file"
            accept="image/*,application/pdf"
            onChange={(event) => void handleProofChange(event)}
            style={{
              display: 'block',
              width: '100%',
              marginBottom: 8,
              fontFamily: "'Inter', sans-serif",
              fontSize: '.86rem',
            }}
          />
          {proofName && (
            <p style={{ color: 'var(--ink-500)', marginBottom: 12, fontSize: '.86rem' }}>
              {proofName}
            </p>
          )}
          {proofError && (
            <p style={{ color: 'var(--atraso-700)', marginBottom: 12, fontSize: '.88rem' }}>
              {proofError}
            </p>
          )}

          {validationError && (
            <p role="alert" style={{ color: 'var(--atraso-700)', margin: '4px 0 16px' }}>
              {validationError}
            </p>
          )}
          {save.isError && (
            <p role="alert" style={{ color: 'var(--atraso-700)', margin: '4px 0 16px' }}>
              Não foi possível salvar a entrada. Tente novamente.
            </p>
          )}
          {deleteIncome.isError && (
            <p role="alert" style={{ color: 'var(--atraso-700)', margin: '4px 0 16px' }}>
              Não foi possível excluir a entrada. Tente novamente.
            </p>
          )}

          <PrimaryButton icon="check" onClick={submit}>
            Salvar entrada
          </PrimaryButton>

          {incomeId && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 12,
                minHeight: 46,
                border: 'none',
                borderRadius: 'var(--r-md)',
                background: 'transparent',
                color: 'var(--atraso-700)',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: '.92rem',
                cursor: 'pointer',
              }}
            >
              Excluir entrada
            </button>
          )}
        </div>
      </ScreenBody>
      <ConfirmDialog
        open={confirmingDelete}
        title="Excluir entrada?"
        confirmLabel="Excluir"
        tone="danger"
        isPending={deleteIncome.isPending}
        onConfirm={() => {
          if (!incomeId) return;
          deleteIncome.mutate(incomeId, { onSuccess: onBack });
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </Screen>
  );
}
