import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import type { LoginResponse } from '@/features/session/domain/login-response';
import { Field, PrimaryButton } from '@/shared/ui/primitives';

import type { UserAccountRepository } from '../domain/account-repository';
import { accountErrorKind } from '../domain/errors';

import { accountErrorMessage } from './account-error-message';
import { EntryForm, EntryLayout, FormError, LinkRow, TextLink } from './entry-layout';

type Props = {
  token: string;
  repository: UserAccountRepository;
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
  const invalidLink = confirm.isError && accountErrorKind(confirm.error) === 'invalid-link';

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
    ? accountErrorMessage(confirm.error, { 'invalid-credentials': 'Senha incorreta.' })
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
