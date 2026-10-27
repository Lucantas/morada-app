import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { z } from 'zod';

import {
  condoRoleSchema,
  orgRoleSchema,
  permissionSchema,
  type CondoRole,
  type OrgRole,
  type Permission,
} from './permissions';

export type CurrentCondo = {
  id: string;
  name: string;
  condoRole: CondoRole;
  permissions: readonly Permission[];
  hasHome: boolean;
  organizationId: string;
  orgRole: OrgRole | null;
  onboardingPending: boolean;
};

const currentCondoSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  condoRole: condoRoleSchema,
  permissions: z.array(permissionSchema),
  hasHome: z.boolean(),
  organizationId: z.string().min(1),
  orgRole: orgRoleSchema.nullable(),
  onboardingPending: z.boolean().default(false),
});

type CondoScopeState = {
  condo: CurrentCondo | null;
  setCondo: (condo: CurrentCondo | null) => void;
  rename: (name: string) => void;
  completeOnboarding: () => void;
};

function parseStoredCondo(persisted: unknown): CurrentCondo | null {
  const stored = z.object({ condo: z.unknown() }).safeParse(persisted);
  if (!stored.success) return null;
  const parsed = currentCondoSchema.safeParse(stored.data.condo);
  return parsed.success ? parsed.data : null;
}

export const useCondoScope = create<CondoScopeState>()(
  persist(
    (set) => ({
      condo: null,
      setCondo: (condo) => set({ condo }),
      rename: (name) => set((state) => (state.condo ? { condo: { ...state.condo, name } } : state)),
      completeOnboarding: () =>
        set((state) =>
          state.condo ? { condo: { ...state.condo, onboardingPending: false } } : state,
        ),
    }),
    {
      name: 'morada-condo',
      version: 1,
      partialize: (state) => ({ condo: state.condo }),
      migrate: (persisted) => ({ condo: parseStoredCondo(persisted) }),
      merge: (persisted, current) => ({ ...current, condo: parseStoredCondo(persisted) }),
    },
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
const ORG_PREFIX = '/api/orgs/';

export function scopedApiPath(path: string, condoId: string | null): string {
  if (!path.startsWith(API_PREFIX) || path.startsWith(ORG_PREFIX)) return path;
  if (!condoId) throw new Error('Nenhum condomínio selecionado');
  return `/api/condos/${condoId}/${path.slice(API_PREFIX.length)}`;
}
