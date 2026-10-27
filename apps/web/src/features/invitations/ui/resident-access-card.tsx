import { useQuery } from '@tanstack/react-query';

import { FormError } from '@/shared/ui/entry-layout';

import type { InvitationRepository } from '../domain/invitation-repository';

import { InvitationPanel, invitationKey } from './invitation-panel';

type Props = {
  residentId: string;
  residentEmail: string;
  repository: Pick<InvitationRepository, 'invitation' | 'invite' | 'revoke'>;
};

export function ResidentAccessCard({ residentId, residentEmail, repository }: Props) {
  const invitation = useQuery({
    queryKey: invitationKey(residentId),
    queryFn: () => repository.invitation(residentId),
  });

  if (invitation.isPending) {
    return (
      <p role="status" style={{ color: 'var(--ink-500)', margin: '0 0 16px' }}>
        Carregando acesso…
      </p>
    );
  }
  if (invitation.isError) {
    return <FormError message="Não foi possível carregar o acesso." />;
  }
  return (
    <InvitationPanel
      residentId={residentId}
      residentEmail={residentEmail}
      view={invitation.data}
      repository={repository}
    />
  );
}
