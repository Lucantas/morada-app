import { useState, type ChangeEvent } from 'react';

import { Icon } from '@/shared/ui/icon';
import { Screen, ScreenBody } from '@/shared/ui/phone-frame';
import { Field, PrimaryButton } from '@/shared/ui/primitives';

import type { NoticeKind } from '../domain/notice';
import type { NoticeRepository } from '../domain/notice-repository';

import { noticeKindView } from './notice-kind-view';
import { useCreateNotice } from './use-notices';

const AUDIENCES = ['Todos os moradores', 'Bloco 2', 'Síndico'];
const KINDS: NoticeKind[] = ['aviso', 'urgente', 'manutencao'];

type Props = {
  repository: NoticeRepository;
  onSent: () => void;
  onBack: () => void;
};

export function SendNoticeScreen({ repository, onSent, onBack }: Props) {
  const create = useCreateNotice(repository);
  const [audience, setAudience] = useState<string>(AUDIENCES[0] ?? 'Todos os moradores');
  const [kind, setKind] = useState<NoticeKind>('aviso');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const canSend = title.trim().length > 0 && body.trim().length > 0;

  const submit = () => {
    if (!canSend) return;
    create.mutate({ title, body, kind, audience }, { onSuccess: onSent });
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '.78rem', color: '#A9C6C9', fontWeight: 500 }}>
            Avisos · Bloco 2
          </div>
          <div className="fraunces" style={{ fontSize: '1.35rem', fontWeight: 600, color: '#fff' }}>
            Enviar aviso
          </div>
        </div>
      </div>
      <ScreenBody>
        <div style={{ paddingTop: 2 }}>
          <label
            style={{
              display: 'block',
              fontWeight: 600,
              fontSize: '.9rem',
              marginBottom: 9,
              color: 'var(--ink-900)',
            }}
          >
            Destinatário
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {AUDIENCES.map((option) => {
              const active = audience === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setAudience(option)}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    borderRadius: 'var(--r-sm)',
                    border: `1.5px solid ${active ? 'var(--petrol-600)' : 'var(--line)'}`,
                    background: active ? 'var(--petrol-50)' : 'var(--surface)',
                    color: active ? 'var(--petrol-800)' : 'var(--ink-500)',
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 600,
                    fontSize: '.82rem',
                    cursor: 'pointer',
                  }}
                >
                  {option}
                </button>
              );
            })}
          </div>

          <label
            style={{
              display: 'block',
              fontWeight: 600,
              fontSize: '.9rem',
              marginBottom: 9,
              color: 'var(--ink-900)',
            }}
          >
            Tipo
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {KINDS.map((option) => {
              const view = noticeKindView(option);
              const active = kind === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setKind(option)}
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

          <Field
            label="Título"
            value={title}
            onChange={setTitle}
            placeholder="Ex.: Portão da garagem"
          />

          <label style={{ display: 'block', marginBottom: 16 }}>
            <span
              style={{
                display: 'block',
                fontWeight: 600,
                fontSize: '.9rem',
                marginBottom: 7,
                color: 'var(--ink-900)',
              }}
            >
              Mensagem
            </span>
            <textarea
              value={body}
              placeholder="Escreva o aviso para os moradores"
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
              style={{
                width: '100%',
                minHeight: 120,
                border: '1.5px solid var(--line)',
                borderRadius: 'var(--r-md)',
                padding: '12px 15px',
                fontFamily: "'Inter', sans-serif",
                fontSize: '1rem',
                color: 'var(--ink-900)',
                background: 'var(--surface)',
                resize: 'vertical',
              }}
            />
          </label>

          {!canSend && (
            <p style={{ color: 'var(--ink-500)', marginBottom: 12, fontSize: '.88rem' }}>
              Preencha o título e a mensagem para enviar.
            </p>
          )}

          <PrimaryButton icon="check" onClick={submit}>
            Enviar aviso
          </PrimaryButton>
        </div>
      </ScreenBody>
    </Screen>
  );
}
