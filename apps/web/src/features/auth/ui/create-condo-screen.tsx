import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import type { LoginCondo } from '@/features/session/domain/login-response';
import { Field, PrimaryButton } from '@/shared/ui/primitives';

import type { AuthRepository } from '../domain/auth-repository';
import { condoNameSchema, validate } from '../domain/auth-schemas';

import { authErrorMessage } from './auth-error-message';
import { EntryForm, EntryLayout, FormError, LinkRow, TextLink } from './entry-layout';

type Props = {
  repository: AuthRepository;
  onCreated: (condo: LoginCondo) => void;
  onSignOut: () => void;
};

export function CreateCondoScreen({ repository, onCreated, onSignOut }: Props) {
  const [name, setName] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (condoName: string) => repository.createCondo(condoName),
    onSuccess: (condo) => onCreated(condo),
  });

  const submit = () => {
    const result = validate(condoNameSchema, name);
    if (!result.ok) {
      setInvalid(result.message);
      return;
    }
    setInvalid(null);
    create.mutate(result.data);
  };

  const error =
    invalid ??
    (create.isError
      ? authErrorMessage(create.error, {
          unavailable: 'Não foi possível criar o condomínio. Tente novamente.',
        })
      : null);

  return (
    <EntryLayout title="Que condomínio vamos gerenciar hoje?">
      <EntryForm onSubmit={submit}>
        <Field label="Nome do condomínio" value={name} onChange={setName} autoComplete="off" />
        <FormError message={error} />
        <PrimaryButton type="submit" disabled={create.isPending}>
          {create.isPending ? 'Criando…' : 'Criar condomínio'}
        </PrimaryButton>
      </EntryForm>
      <LinkRow>
        <TextLink onClick={onSignOut}>Sair</TextLink>
      </LinkRow>
    </EntryLayout>
  );
}
