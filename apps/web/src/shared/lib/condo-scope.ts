import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CurrentCondo = { id: string; name: string };

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

const API_PREFIX = '/api/';

export function scopedApiPath(path: string, condoId: string | null): string {
  if (!path.startsWith(API_PREFIX)) return path;
  if (!condoId) throw new Error('Nenhum condomínio selecionado');
  return `/api/condos/${condoId}/${path.slice(API_PREFIX.length)}`;
}
