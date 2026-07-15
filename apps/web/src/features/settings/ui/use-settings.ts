import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CondoSettings } from '../domain/condo-settings';
import type { SettingsRepository } from '../domain/settings-repository';

export const settingsQueryKey = ['settings'] as const;

export function useSettings(repository: SettingsRepository) {
  return useQuery({ queryKey: settingsQueryKey, queryFn: () => repository.get() });
}

export function useSaveSettings(repository: SettingsRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: CondoSettings) => repository.save(settings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsQueryKey }),
  });
}
