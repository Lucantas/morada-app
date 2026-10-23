import { useMutation, useQuery } from '@tanstack/react-query';

import { PrimaryButton, SectionLabel, SurfaceCard } from '@/shared/ui/primitives';

import type { InvitationRepository } from '../domain/invitation-repository';

import { CredentialRow } from './copy-button';

type Props = {
  residentId: string;
  repository: Pick<InvitationRepository, 'legacyLogin' | 'resetLegacyLogin'>;
};

export function LegacyLoginCard({ residentId, repository }: Props) {
  const login = useQuery({
    queryKey: ['legacy-login', residentId],
    queryFn: () => repository.legacyLogin(residentId),
  });
  const reset = useMutation({ mutationFn: () => repository.resetLegacyLogin(residentId) });

  if (login.isError) {
    return (
      <p style={{ color: 'var(--ink-500)', fontSize: '.88rem', marginTop: 24 }}>
        Não foi possível consultar o login antigo.
      </p>
    );
  }
  if (!login.data) return null;

  return (
    <div style={{ marginTop: 28 }}>
      <SectionLabel>Login antigo</SectionLabel>
      <p style={{ color: 'var(--ink-500)', fontSize: '.9rem', margin: '0 0 12px' }}>
        Este morador ainda entra com usuário e senha. Quando ele aceitar o convite, esse login deixa
        de funcionar.
      </p>
      <SurfaceCard>
        <CredentialRow label="Usuário" value={login.data} testId="login-username" />
        {reset.data && (
          <>
            <CredentialRow
              label="Senha temporária"
              value={reset.data.tempPassword}
              testId="temp-password"
            />
            <p style={{ color: 'var(--ink-700)', fontSize: '.88rem', margin: '10px 0 0' }}>
              Anote e repasse ao morador — a senha não será mostrada novamente.
            </p>
          </>
        )}
      </SurfaceCard>
      {reset.isError && (
        <p role="alert" style={{ color: 'var(--atraso-700)', margin: '14px 0' }}>
          Não foi possível redefinir a senha.
        </p>
      )}
      <div style={{ marginTop: 14 }}>
        <PrimaryButton icon="check" onClick={() => reset.mutate()} disabled={reset.isPending}>
          {reset.isPending ? 'Redefinindo…' : 'Redefinir senha'}
        </PrimaryButton>
      </div>
    </div>
  );
}
