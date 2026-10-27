import { useState, type FormEvent, type ReactNode } from 'react';

import { EMPTY_PIX_DRAFT, type PixDraft } from '@/features/settings/domain/pix-draft';
import {
  PIX_KEY_TYPES,
  PIX_KEY_TYPE_LABELS,
  type PixKeyType,
} from '@/features/settings/domain/pix-settings';
import { MoneyInput } from '@/shared/ui/money-input';
import { Field, PrimaryButton } from '@/shared/ui/primitives';

import {
  defaultBlockNames,
  type AnswerInput,
  type ConversationState,
} from '../domain/conversation';

type Send = (input: AnswerInput) => void;

const LATER = 'Depois eu vejo';
const DEFAULT_DUE_DAY = '10';

export function Chip({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 44,
        padding: '0 16px',
        border: '1.5px solid var(--petrol-100)',
        borderRadius: 999,
        background: 'var(--petrol-50)',
        color: 'var(--petrol-700)',
        fontFamily: "'Inter', sans-serif",
        fontWeight: 600,
        fontSize: '.95rem',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function ChipRow({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>;
}

function ComposerForm({ onSubmit, children }: { onSubmit: () => void; children: ReactNode }) {
  return (
    <form
      noValidate
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {children}
      <PrimaryButton type="submit">Enviar</PrimaryButton>
    </form>
  );
}

function toNumber(raw: string): number {
  return raw.trim() === '' ? Number.NaN : Number(raw);
}

function NameComposer({ send }: { send: Send }) {
  const [name, setName] = useState('');
  return (
    <ComposerForm onSubmit={() => send({ question: 'name', name })}>
      <Field label="Nome do condomínio" value={name} onChange={setName} autoComplete="off" />
    </ComposerForm>
  );
}

function BlockCountComposer({ send }: { send: Send }) {
  const [count, setCount] = useState('');
  return (
    <ComposerForm onSubmit={() => send({ question: 'blockCount', count: toNumber(count) })}>
      <Field label="Quantos blocos" type="number" value={count} onChange={setCount} />
    </ComposerForm>
  );
}

function BlockNamesComposer({ send, count }: { send: Send; count: number }) {
  const [names, setNames] = useState('');
  return (
    <>
      <ChipRow>
        <Chip onClick={() => send({ question: 'blockNames', names: defaultBlockNames(count) })}>
          A, B, C…
        </Chip>
      </ChipRow>
      <div style={{ height: 12 }} />
      <ComposerForm onSubmit={() => send({ question: 'blockNames', names })}>
        <Field
          label="Nomes dos blocos"
          value={names}
          onChange={setNames}
          placeholder="Norte, Sul"
          autoComplete="off"
        />
      </ComposerForm>
    </>
  );
}

function ShapeComposer({ send }: { send: Send }) {
  const [floors, setFloors] = useState('');
  const [perFloor, setPerFloor] = useState('');
  const submit = () =>
    send({ question: 'shape', floors: toNumber(floors), perFloor: toNumber(perFloor) });
  return (
    <ComposerForm onSubmit={submit}>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Andares" type="number" value={floors} onChange={setFloors} />
        </div>
        <div style={{ flex: 1 }}>
          <Field
            label="Apartamentos por andar"
            type="number"
            value={perFloor}
            onChange={setPerFloor}
          />
        </div>
      </div>
    </ComposerForm>
  );
}

function FeeComposer({ send }: { send: Send }) {
  const [feeCents, setFeeCents] = useState(0);
  const [dueDay, setDueDay] = useState(DEFAULT_DUE_DAY);
  const submit = () => send({ question: 'fee', fee: { feeCents, dueDay: toNumber(dueDay) } });
  return (
    <>
      <ChipRow>
        <Chip onClick={() => send({ question: 'fee', fee: null })}>{LATER}</Chip>
      </ChipRow>
      <div style={{ height: 12 }} />
      <ComposerForm onSubmit={submit}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 3 }}>
            <MoneyInput label="Valor por mês" value={feeCents} onChange={setFeeCents} />
          </div>
          <div style={{ flex: 2 }}>
            <Field label="Dia do vencimento" type="number" value={dueDay} onChange={setDueDay} />
          </div>
        </div>
      </ComposerForm>
    </>
  );
}

function isPixKeyType(value: string): value is PixKeyType {
  return PIX_KEY_TYPES.some((type) => type === value);
}

function KeyTypeSelect({
  value,
  onChange,
}: {
  value: PixKeyType;
  onChange: (type: PixKeyType) => void;
}) {
  return (
    <label style={{ display: 'block', marginBottom: 16 }}>
      <span style={{ display: 'block', fontWeight: 600, fontSize: '.9rem', marginBottom: 7 }}>
        Tipo de chave
      </span>
      <select
        value={value}
        onChange={(event) => {
          if (isPixKeyType(event.target.value)) onChange(event.target.value);
        }}
        style={{
          width: '100%',
          minHeight: 50,
          border: '1.5px solid var(--line)',
          borderRadius: 'var(--r-md)',
          padding: '0 12px',
          fontFamily: "'Inter', sans-serif",
          fontSize: '1rem',
          color: 'var(--ink-900)',
          background: 'var(--surface)',
        }}
      >
        {PIX_KEY_TYPES.map((type) => (
          <option key={type} value={type}>
            {PIX_KEY_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
    </label>
  );
}

function PixComposer({ send }: { send: Send }) {
  const [draft, setDraft] = useState<PixDraft>(EMPTY_PIX_DRAFT);
  const change = (patch: Partial<PixDraft>) => setDraft((current) => ({ ...current, ...patch }));
  return (
    <>
      <ChipRow>
        <Chip onClick={() => send({ question: 'pix', draft: null })}>{LATER}</Chip>
      </ChipRow>
      <div style={{ height: 12 }} />
      <ComposerForm onSubmit={() => send({ question: 'pix', draft })}>
        <KeyTypeSelect value={draft.keyType} onChange={(keyType) => change({ keyType })} />
        <Field
          label="Chave Pix"
          value={draft.key}
          onChange={(key) => change({ key })}
          autoComplete="off"
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 3 }}>
            <Field
              label="Nome do recebedor"
              value={draft.receiverName}
              onChange={(receiverName) => change({ receiverName })}
            />
          </div>
          <div style={{ flex: 2 }}>
            <Field label="Cidade" value={draft.city} onChange={(city) => change({ city })} />
          </div>
        </div>
      </ComposerForm>
    </>
  );
}

function blockCountOf(state: ConversationState): number {
  const answer = state.answers.find((item) => item.question === 'blockCount');
  return answer?.question === 'blockCount' ? answer.count : 0;
}

export function Composer({ state, send }: { state: ConversationState; send: Send }) {
  switch (state.current) {
    case 'name':
      return <NameComposer send={send} />;
    case 'hasBlocks':
      return (
        <ChipRow>
          <Chip onClick={() => send({ question: 'hasBlocks', hasBlocks: false })}>
            Só um prédio
          </Chip>
          <Chip onClick={() => send({ question: 'hasBlocks', hasBlocks: true })}>Tem blocos</Chip>
        </ChipRow>
      );
    case 'blockCount':
      return <BlockCountComposer send={send} />;
    case 'blockNames':
      return <BlockNamesComposer send={send} count={blockCountOf(state)} />;
    case 'sameShape':
      return (
        <ChipRow>
          <Chip onClick={() => send({ question: 'sameShape', same: true })}>Sim</Chip>
          <Chip onClick={() => send({ question: 'sameShape', same: false })}>Não</Chip>
        </ChipRow>
      );
    case 'shape':
      return <ShapeComposer send={send} />;
    case 'fee':
      return <FeeComposer send={send} />;
    case 'pix':
      return <PixComposer send={send} />;
    case 'review':
      return null;
  }
}
