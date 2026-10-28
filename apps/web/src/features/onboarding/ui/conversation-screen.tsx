import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';

import type { AuthRepository } from '@/features/auth/domain/auth-repository';
import { authErrorKind, type AuthErrorKind } from '@/features/auth/domain/errors';
import type { LoginCondo } from '@/features/session/domain/login-response';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { FormError, TextLink } from '@/shared/ui/entry-layout';
import { Icon } from '@/shared/ui/icon';
import { PrimaryButton } from '@/shared/ui/primitives';

import {
  answer,
  questionText,
  reviewSummary,
  startConversation,
  toCreateCondoInput,
  transcript,
  undo,
  type AnswerInput,
  type ConversationState,
} from '../domain/conversation';
import type { DraftStore } from '../domain/draft-store';

import { Composer } from './composer';

type Props = {
  repository: AuthRepository;
  drafts: DraftStore;
  onCreated: (condo: LoginCondo) => void;
  onSignOut: () => void;
  leaveLabel?: string;
};

const CREATE_ERRORS: Partial<Record<AuthErrorKind, string>> = {
  'email-not-confirmed': 'Confirme seu e-mail antes de criar um condomínio.',
  'session-expired': 'Sua sessão expirou. Entre novamente.',
  'invalid-input': 'Confira os dados informados.',
  'rate-limited': 'Muitas tentativas, tente mais tarde.',
};

function createErrorMessage(error: unknown): string {
  return (
    CREATE_ERRORS[authErrorKind(error)] ?? 'Não foi possível criar o condomínio. Tente novamente.'
  );
}

function Bubble({ mine = false, children }: { mine?: boolean; children: ReactNode }) {
  return (
    <div
      className="chat-bubble"
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        padding: '10px 14px',
        borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: mine ? 'var(--petrol-700)' : 'var(--surface)',
        color: mine ? 'var(--surface)' : 'var(--petrol-900)',
        border: mine ? 'none' : '1px solid var(--line)',
        fontSize: mine ? '.98rem' : '1.05rem',
        fontFamily: mine ? "'Inter', sans-serif" : "'Fraunces', serif",
        lineHeight: 1.35,
        overflowWrap: 'anywhere',
      }}
    >
      {children}
    </div>
  );
}

function Transcript({
  state,
  onCorrect,
}: {
  state: ConversationState;
  onCorrect: (() => void) | null;
}) {
  const lines = transcript(state);
  const lastIndex = lines.length - 1;
  return (
    <div role="log" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {lines.map((line, index) => (
        <div key={`${index}-${line.question}`} style={{ display: 'contents' }}>
          <Bubble>{line.question}</Bubble>
          <Bubble mine>{line.answer}</Bubble>
          {index === lastIndex && onCorrect && (
            <div style={{ alignSelf: 'flex-end', marginTop: -8 }}>
              <TextLink onClick={onCorrect}>Corrigir</TextLink>
            </div>
          )}
        </div>
      ))}
      <Bubble>{questionText(state)}</Bubble>
      {state.current === 'review' && (
        <Bubble>
          {reviewSummary(state).map((line) => (
            <div key={line}>{line}</div>
          ))}
        </Bubble>
      )}
    </div>
  );
}

function Header({ onSignOut, label }: { onSignOut: (() => void) | null; label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px 0',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          background: 'var(--brass-500)',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--petrol-900)',
        }}
      >
        <Icon name="bank" size={20} color="currentColor" />
      </div>
      {onSignOut && <TextLink onClick={onSignOut}>{label}</TextLink>}
    </div>
  );
}

export function ConversationScreen({
  repository,
  drafts,
  onCreated,
  onSignOut,
  leaveLabel = 'Sair',
}: Props) {
  const [state, setState] = useState<ConversationState>(() => drafts.load() ?? startConversation());
  const [invalid, setInvalid] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const create = useMutation({
    mutationFn: (current: ConversationState) => repository.createCondo(toCreateCondoInput(current)),
    onSuccess: (condo) => {
      drafts.clear();
      onCreated(condo);
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [state]);

  const change = (next: ConversationState) => {
    setInvalid(null);
    create.reset();
    setState(next);
    drafts.save(next);
  };

  const send = (input: AnswerInput) => {
    const result = answer(state, input);
    if ('error' in result) {
      setInvalid(result.error);
      return;
    }
    change(result.state);
  };

  const submit = () => {
    if (create.isPending) return;
    create.mutate(state);
  };

  const busy = create.isPending;
  const error = invalid ?? (create.isError ? createErrorMessage(create.error) : null);
  const name = state.answers.find((item) => item.question === 'name')?.text ?? '';

  return (
    <Screen>
      <Header onSignOut={busy ? null : onSignOut} label={leaveLabel} />
      <ScreenBody>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <Transcript state={state} onCorrect={busy ? null : () => change(undo(state))} />
          <div ref={endRef} />
        </div>
      </ScreenBody>
      <div
        style={{
          borderTop: '1px solid var(--line-soft)',
          background: 'var(--sand)',
          padding: '14px 16px calc(14px + env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <FormError message={error} />
          {state.current === 'review' ? (
            <PrimaryButton disabled={busy} onClick={submit}>
              {busy ? 'Criando…' : `Criar o ${name}`}
            </PrimaryButton>
          ) : (
            <Composer key={`${state.current}-${state.answers.length}`} state={state} send={send} />
          )}
        </div>
      </div>
    </Screen>
  );
}
