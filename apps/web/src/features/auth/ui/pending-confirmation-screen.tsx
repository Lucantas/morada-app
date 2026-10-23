import { useMutation } from '@tanstack/react-query';

import { PrimaryButton } from '@/shared/ui/primitives';

import type { AuthRepository } from '../domain/auth-repository';

import { authErrorMessage } from './auth-error-message';
import { EntryLayout, FormError, FormNotice, LinkRow, TextLink } from './entry-layout';

type Props = { repository: AuthRepository; onSignOut: () => void };

export function PendingConfirmationScreen({ repository, onSignOut }: Props) {
  const resend = useMutation({ mutationFn: () => repository.resendConfirmation() });

  return (
    <EntryLayout
      title="Confirme seu e-mail"
      intro="Enviamos um link de confirmação para o seu e-mail. Abra o link para começar a usar o Morada."
    >
      {resend.isSuccess && <FormNotice>Enviamos um novo link para o seu e-mail.</FormNotice>}
      <FormError message={resend.isError ? authErrorMessage(resend.error) : null} />
      <PrimaryButton onClick={() => resend.mutate()} disabled={resend.isPending}>
        {resend.isPending ? 'Enviando…' : 'Reenviar link'}
      </PrimaryButton>
      <LinkRow>
        <TextLink onClick={onSignOut}>Sair</TextLink>
      </LinkRow>
    </EntryLayout>
  );
}
