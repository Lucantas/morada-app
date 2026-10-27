import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import type { LoginResponse } from '@/features/session/domain/login-response';
import { EntryForm, EntryLayout, FormError, LinkRow, TextLink } from '@/shared/ui/entry-layout';
import { Field, PrimaryButton } from '@/shared/ui/primitives';

import { invitationErrorKind } from '../domain/errors';
import {
  acceptMode,
  buildAcceptInput,
  type AcceptInput,
  type AcceptMode,
  type InvitationPreview,
  type InvitationRole,
} from '../domain/invitation';
import type { InvitationRepository } from '../domain/invitation-repository';

import { INVALID_INVITATION, invitationErrorMessage } from './invitation-error-message';

type Props = {
  token: string;
  repository: Pick<InvitationRepository, 'preview' | 'accept'>;
  onAccepted: (response: LoginResponse, condoName: string | null) => void;
  onSignIn: () => void;
  onForgotPassword: () => void;
};

export function AcceptInviteScreen({
  token,
  repository,
  onAccepted,
  onSignIn,
  onForgotPassword,
}: Props) {
  const preview = useQuery({
    queryKey: ['invitation-preview', token],
    queryFn: () => repository.preview(token),
    retry: false,
    staleTime: Infinity,
  });

  if (preview.isPending) {
    return (
      <EntryLayout title="Convite">
        <p role="status" style={{ color: 'var(--ink-500)' }}>
          Carregando convite…
        </p>
      </EntryLayout>
    );
  }

  if (preview.isError) {
    const invalid = invitationErrorKind(preview.error) === 'invalid-invitation';
    return (
      <EntryLayout title="Convite">
        <FormError
          message={
            invalid
              ? INVALID_INVITATION
              : 'Não foi possível carregar o convite. Verifique a conexão com o servidor.'
          }
        />
        {!invalid && (
          <PrimaryButton onClick={() => void preview.refetch()}>Tentar novamente</PrimaryButton>
        )}
        <LinkRow>
          <TextLink onClick={onSignIn}>Ir para o login</TextLink>
        </LinkRow>
      </EntryLayout>
    );
  }

  return (
    <AcceptForm
      token={token}
      preview={preview.data}
      repository={repository}
      onAccepted={onAccepted}
      onForgotPassword={onForgotPassword}
    />
  );
}

function acceptedCondoName(preview: InvitationPreview): string | null {
  return preview.role === 'membro' ? null : preview.targetName;
}

function heading(role: InvitationRole, targetName: string): string {
  if (role === 'sindico') return `Você foi convidado para ser síndico do ${targetName}`;
  if (role === 'membro') return `Você foi convidado para a equipe ${targetName}`;
  return `Você foi convidado para o ${targetName}`;
}

function subtitle(preview: InvitationPreview): string | undefined {
  if (preview.role !== 'morador') return undefined;
  return `${preview.residentName ?? ''} · ${preview.apt ?? ''}`;
}

const INTRO: Record<AcceptMode, string> = {
  open: 'Se você já tem conta no Morada, use o mesmo e-mail e a sua senha.',
  'existing-account': 'Entre com a senha da sua conta',
  'new-account': 'Crie sua senha para acessar o condomínio.',
};

function AcceptForm({
  token,
  preview,
  repository,
  onAccepted,
  onForgotPassword,
}: {
  token: string;
  preview: InvitationPreview;
  repository: Pick<InvitationRepository, 'accept'>;
  onAccepted: (response: LoginResponse, condoName: string | null) => void;
  onForgotPassword: () => void;
}) {
  const mode = acceptMode(preview);
  const [email, setEmail] = useState(preview.email ?? '');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);
  const accept = useMutation({
    mutationFn: (input: AcceptInput) => repository.accept(token, input),
    onSuccess: (response) => onAccepted(response, acceptedCondoName(preview)),
  });

  const submit = () => {
    const result = buildAcceptInput(mode, { email, name, password, confirmation });
    if (!result.ok) {
      setInvalid(result.message);
      return;
    }
    setInvalid(null);
    accept.mutate(result.data);
  };

  const error = invalid ?? (accept.isError ? invitationErrorMessage(accept.error) : null);
  const asksName = mode !== 'existing-account';

  return (
    <EntryLayout title={heading(preview.role, preview.targetName)} intro={subtitle(preview)}>
      <p style={{ color: 'var(--ink-700)', fontSize: '.95rem', margin: '0 0 18px' }}>
        {INTRO[mode]}
      </p>
      <EntryForm onSubmit={submit}>
        <Field
          label="E-mail"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          readOnly={mode !== 'open'}
        />
        {asksName && <Field label="Seu nome" value={name} onChange={setName} autoComplete="name" />}
        <Field
          label="Senha"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete={mode === 'existing-account' ? 'current-password' : 'new-password'}
          placeholder={mode === 'existing-account' ? undefined : 'Pelo menos 8 caracteres'}
        />
        {mode !== 'new-account' && (
          <LinkRow>
            <TextLink onClick={onForgotPassword}>Esqueci a senha</TextLink>
          </LinkRow>
        )}
        {mode === 'new-account' && (
          <Field
            label="Confirme a senha"
            type="password"
            value={confirmation}
            onChange={setConfirmation}
            autoComplete="new-password"
          />
        )}
        <FormError message={error} />
        <PrimaryButton type="submit" disabled={accept.isPending}>
          {accept.isPending ? 'Aceitando…' : 'Aceitar convite'}
        </PrimaryButton>
      </EntryForm>
    </EntryLayout>
  );
}
