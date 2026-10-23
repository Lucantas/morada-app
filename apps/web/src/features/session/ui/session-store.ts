import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { useCondoScope } from '@/shared/lib/condo-scope';

import type { LoginResponse } from '../domain/login-response';
import type { Role } from '../domain/session';

export type PendingAccount = { emailVerified: boolean };

type SessionState = {
  role: Role | null;
  subject: string | null;
  account: PendingAccount | null;
  authenticate: (role: Role, subject: string | null) => void;
  signOut: () => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      role: null,
      subject: null,
      account: null,
      authenticate: (role, subject) => set({ role, subject, account: null }),
      signOut: () => {
        set({ role: null, subject: null, account: null });
        useCondoScope.getState().setCondo(null);
      },
    }),
    {
      name: 'morada-session',
      partialize: (state) => ({
        role: state.role,
        subject: state.subject,
        account: state.account,
      }),
    },
  ),
);

export function applyLogin({ condos, emailVerified }: LoginResponse): Role | null {
  const [first] = condos;
  if (!first) {
    useCondoScope.getState().setCondo(null);
    useSessionStore.setState({ role: null, subject: null, account: { emailVerified } });
    return null;
  }
  useCondoScope.getState().setCondo({ id: first.id, name: first.name });
  useSessionStore.getState().authenticate(first.role, null);
  return first.role;
}

export function signOutIfCondoMissing(): void {
  if (useSessionStore.getState().role && !useCondoScope.getState().condo) {
    useSessionStore.getState().signOut();
  }
}
