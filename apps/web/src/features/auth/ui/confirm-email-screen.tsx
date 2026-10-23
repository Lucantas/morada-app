import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import type { LoginResponse } from '@/features/session/domain/login-response';
import { Field, PrimaryButton } from '@/shared/ui/primitives';

import type { AuthRepository } from '../domain/auth-repository';
import { authErrorKind } from '../domain/errors';

import { authErrorMessage } from './auth-error-message';
import { EntryForm, EntryLayout, FormError, LinkRow, TextLink } from '@/shared/ui/entry-layout';

type Props = {
  token: string;
  repository: AuthRepository;
  onLoggedIn: (response: LoginResponse) => void;
  onSignIn: () => void;
  onForgotPassword: () => void;
};

export function ConfirmEmailScreen({
  token,
  repository,
  onLoggedIn,
  onSignIn,
  onForgotPassword,
}: Props) {
  const [password, setPassword] = useState('');
  const confirm = useMutation({
    mutationFn: (secret: string) => repository.confirmEmail(token, secret),
    onSuccess: (response) => onLoggedIn(response),
  });
  const invalidLink = confirm.isError && authErrorKind(confirm.error) === 'invalid-link';

  const hint = (
    <LinkRow>
      <span style={{ color: 'var(--ink-500)', fontSize: '.9rem', alignSelf: 'center' }}>
        Não consegue confirmar? Use “Esqueci a senha”.
      </span>
      <TextLink onClick={onForgotPassword}>Esqueci a senha</TextLink>
    </LinkRow>
  );

  if (invalidLink) {
    return (
      <EntryLayout
        title="Link inválido ou expirado"
        intro="Entre na sua conta para receber um novo link de confirmação."
      >
        <PrimaryButton onClick={onSignIn}>Entrar para receber um novo link</PrimaryButton>
        {hint}
      </EntryLayout>
    );
  }

  const error = confirm.isError
    ? authErrorMessage(confirm.error, { 'invalid-credentials': 'Senha incorreta.' })
    : null;

  return (
    <EntryLayout
      title="Confirmar e-mail"
      intro="Para sua segurança, digite a senha da sua conta para confirmar o e-mail."
    >
      <EntryForm
        onSubmit={() => {
          if (password) confirm.mutate(password);
        }}
      >
        <Field
          label="Senha"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <FormError message={error} />
        <PrimaryButton type="submit" disabled={confirm.isPending}>
          {confirm.isPending ? 'Confirmando…' : 'Confirmar e-mail'}
        </PrimaryButton>
      </EntryForm>
      {hint}
    </EntryLayout>
  );
}
