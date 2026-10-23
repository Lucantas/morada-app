import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { useCondoScope } from '@/shared/lib/condo-scope';

import type { LoginCondo } from '../domain/login-response';
import type { Role } from '../domain/session';

type SessionState = {
  role: Role | null;
  subject: string | null;
  authenticate: (role: Role, subject: string | null) => void;
  signOut: () => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      role: null,
      subject: null,
      authenticate: (role, subject) => set({ role, subject }),
      signOut: () => {
        set({ role: null, subject: null });
        useCondoScope.getState().setCondo(null);
      },
    }),
    {
      name: 'morada-session',
      partialize: (state) => ({ role: state.role, subject: state.subject }),
    },
  ),
);

export function applyLogin(condos: readonly LoginCondo[]): Role {
  const [first] = condos;
  if (!first) throw new Error('Nenhum condomínio disponível');
  useCondoScope.getState().setCondo({ id: first.id, name: first.name });
  useSessionStore.getState().authenticate(first.role, null);
  return first.role;
}

export function signOutIfCondoMissing(): void {
  if (useSessionStore.getState().role && !useCondoScope.getState().condo) {
    useSessionStore.getState().signOut();
  }
}
