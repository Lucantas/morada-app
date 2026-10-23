import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { CondoRole, OrgRole, Permission } from './permissions';

export type CurrentCondo = {
  id: string;
  name: string;
  condoRole: CondoRole;
  permissions: readonly Permission[];
  hasHome: boolean;
  organizationId: string;
  orgRole: OrgRole | null;
};

type CondoScopeState = {
  condo: CurrentCondo | null;
  setCondo: (condo: CurrentCondo | null) => void;
  rename: (name: string) => void;
};

export const useCondoScope = create<CondoScopeState>()(
  persist(
    (set) => ({
      condo: null,
      setCondo: (condo) => set({ condo }),
      rename: (name) => set((state) => (state.condo ? { condo: { ...state.condo, name } } : state)),
    }),
    { name: 'morada-condo', partialize: (state) => ({ condo: state.condo }) },
  ),
);

export function useCondoName(): string {
  return useCondoScope((state) => state.condo?.name ?? '');
}

export function useCanDo(permission: Permission): boolean {
  return useCondoScope((state) => state.condo?.permissions.includes(permission) ?? false);
}

export function useHasHome(): boolean {
  return useCondoScope((state) => state.condo?.hasHome ?? false);
}

const API_PREFIX = '/api/';

export function scopedApiPath(path: string, condoId: string | null): string {
  if (!path.startsWith(API_PREFIX)) return path;
  if (!condoId) throw new Error('Nenhum condomínio selecionado');
  return `/api/condos/${condoId}/${path.slice(API_PREFIX.length)}`;
}
