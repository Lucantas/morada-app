import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { OrgRole } from '@/shared/lib/permissions';

import type { TeamRepository } from '../domain/team-repository';

export const teamQueryKey = ['team'] as const;

export function useTeam(repository: TeamRepository) {
  return useQuery({ queryKey: teamQueryKey, queryFn: () => repository.get() });
}

export function useTeamActions(repository: TeamRepository) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: teamQueryKey });

  const rename = useMutation({
    mutationFn: (name: string) => repository.rename(name),
    onSuccess: refresh,
  });
  const invite = useMutation({
    mutationFn: (input: { email: string; orgRole: OrgRole; phone?: string }) =>
      repository.invite(input.email, input.orgRole, input.phone),
    onSuccess: refresh,
  });
  const revoke = useMutation({
    mutationFn: (invitationId: string) => repository.revokeInvitation(invitationId),
    onSuccess: refresh,
  });
  const deactivate = useMutation({
    mutationFn: (userId: string) => repository.deactivateMember(userId),
    onSuccess: refresh,
  });
  const assignCondos = useMutation({
    mutationFn: (input: { userId: string; condoIds: readonly string[] }) =>
      repository.assignCondos(input.userId, input.condoIds),
    onSuccess: refresh,
  });

  return { rename, invite, revoke, deactivate, assignCondos };
}
