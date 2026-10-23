import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { Field, PrimaryButton } from '@/shared/ui/primitives';

import type { AuthRepository } from '../domain/auth-repository';
import { signUpInputSchema, validate, type SignUpInput } from '../domain/auth-schemas';

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

export function SignUpScreen({ repository, onBack }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);
  const signUp = useMutation({
    mutationFn: (input: SignUpInput) => repository.signUp(input),
  });

  if (signUp.isSuccess) {
    return (
      <EntryLayout title="Confirme seu e-mail">
        <FormNotice>
          Enviamos um link para {signUp.variables.email}. Abra no celular para confirmar.
        </FormNotice>
        <TextLink onClick={onBack}>Voltar para o login</TextLink>
      </EntryLayout>
    );
  }

  const submit = () => {
    const result = validate(signUpInputSchema, { name, email, password });
    if (!result.ok) {
      setInvalid(result.message);
      return;
    }
    setInvalid(null);
    signUp.mutate(result.data);
  };

  const error = invalid ?? (signUp.isError ? authErrorMessage(signUp.error) : null);

  return (
    <EntryLayout title="Criar conta" intro="Crie sua conta para administrar seu condomínio.">
      <EntryForm onSubmit={submit}>
        <Field label="Nome" value={name} onChange={setName} autoComplete="name" />
        <Field label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field
          label="Senha"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder="Pelo menos 8 caracteres"
        />
        <FormError message={error} />
        <PrimaryButton type="submit" disabled={signUp.isPending}>
          {signUp.isPending ? 'Criando…' : 'Criar conta'}
        </PrimaryButton>
      </EntryForm>
      <LinkRow>
        <TextLink onClick={onBack}>Já tenho conta</TextLink>
      </LinkRow>
    </EntryLayout>
  );
}
