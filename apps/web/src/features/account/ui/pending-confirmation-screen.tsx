import { useMutation } from '@tanstack/react-query';

import { PrimaryButton } from '@/shared/ui/primitives';

import type { UserAccountRepository } from '../domain/account-repository';

import { accountErrorMessage } from './account-error-message';
import { EntryLayout, FormError, FormNotice, LinkRow, TextLink } from './entry-layout';

type Props = { repository: UserAccountRepository; onSignOut: () => void };

export function PendingConfirmationScreen({ repository, onSignOut }: Props) {
  const resend = useMutation({ mutationFn: () => repository.resendConfirmation() });

  return (
    <EntryLayout
      title="Confirme seu e-mail"
      intro="Enviamos um link de confirmação para o seu e-mail. Abra o link para começar a usar o Morada."
    >
      {resend.isSuccess && <FormNotice>Enviamos um novo link para o seu e-mail.</FormNotice>}
      <FormError message={resend.isError ? accountErrorMessage(resend.error) : null} />
      <PrimaryButton onClick={() => resend.mutate()} disabled={resend.isPending}>
        {resend.isPending ? 'Enviando…' : 'Reenviar link'}
      </PrimaryButton>
      <LinkRow>
        <TextLink onClick={onSignOut}>Sair</TextLink>
      </LinkRow>
    </EntryLayout>
  );
}
