import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { Field, PrimaryButton } from '@/shared/ui/primitives';

import type { AuthRepository } from '../domain/auth-repository';
import { emailSchema, validate } from '../domain/auth-schemas';

import { authErrorMessage } from './auth-error-message';
import {
  EntryForm,
  EntryLayout,
  FormError,
  FormNotice,
  LinkRow,
  TextLink,
} from '@/shared/ui/entry-layout';

type Props = { repository: AuthRepository; onBack: () => void };

export function ForgotPasswordScreen({ repository, onBack }: Props) {
  const [email, setEmail] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);
  const request = useMutation({
    mutationFn: (address: string) => repository.requestPasswordReset(address),
  });

  const submit = () => {
    const result = validate(emailSchema, email);
    if (!result.ok) {
      setInvalid(result.message);
      return;
    }
    setInvalid(null);
    request.mutate(result.data);
  };

  const error = invalid ?? (request.isError ? authErrorMessage(request.error) : null);

  return (
    <EntryLayout
      title="Esqueci a senha"
      intro="Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha."
    >
      {request.isSuccess ? (
        <FormNotice>
          Se houver uma conta com esse e-mail, enviamos um link para redefinir a senha.
        </FormNotice>
      ) : (
        <EntryForm onSubmit={submit}>
          <Field
            label="E-mail"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
          <FormError message={error} />
          <PrimaryButton type="submit" disabled={request.isPending}>
            {request.isPending ? 'Enviando…' : 'Enviar link'}
          </PrimaryButton>
        </EntryForm>
      )}
      <LinkRow>
        <TextLink onClick={onBack}>Voltar para o login</TextLink>
      </LinkRow>
    </EntryLayout>
  );
}
