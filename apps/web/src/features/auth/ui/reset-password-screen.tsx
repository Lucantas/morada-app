import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import type { LoginResponse } from '@/features/session/domain/login-response';
import { Field, PrimaryButton } from '@/shared/ui/primitives';

import type { AuthRepository } from '../domain/auth-repository';
import { newPasswordSchema, validate } from '../domain/auth-schemas';
import { authErrorKind } from '../domain/errors';

import { authErrorMessage } from './auth-error-message';
import { EntryForm, EntryLayout, FormError } from '@/shared/ui/entry-layout';

type Props = {
  token: string;
  repository: AuthRepository;
  onLoggedIn: (response: LoginResponse) => void;
  onRequestNewLink: () => void;
};

export function ResetPasswordScreen({ token, repository, onLoggedIn, onRequestNewLink }: Props) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);
  const reset = useMutation({
    mutationFn: (secret: string) => repository.resetPassword(token, secret),
    onSuccess: (response) => onLoggedIn(response),
  });

  if (reset.isError && authErrorKind(reset.error) === 'invalid-link') {
    return (
      <EntryLayout
        title="Link inválido ou expirado"
        intro="Peça um novo link para redefinir sua senha."
      >
        <PrimaryButton onClick={onRequestNewLink}>Pedir um novo link</PrimaryButton>
      </EntryLayout>
    );
  }

  const submit = () => {
    const result = validate(newPasswordSchema, { password, confirmation });
    if (!result.ok) {
      setInvalid(result.message);
      return;
    }
    setInvalid(null);
    reset.mutate(result.data.password);
  };

  const error = invalid ?? (reset.isError ? authErrorMessage(reset.error) : null);

  return (
    <EntryLayout title="Redefinir senha" intro="Escolha uma nova senha para a sua conta.">
      <EntryForm onSubmit={submit}>
        <Field
          label="Nova senha"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder="Pelo menos 8 caracteres"
        />
        <Field
          label="Confirme a nova senha"
          type="password"
          value={confirmation}
          onChange={setConfirmation}
          autoComplete="new-password"
        />
        <FormError message={error} />
        <PrimaryButton type="submit" disabled={reset.isPending}>
          {reset.isPending ? 'Salvando…' : 'Salvar nova senha'}
        </PrimaryButton>
      </EntryForm>
    </EntryLayout>
  );
}
