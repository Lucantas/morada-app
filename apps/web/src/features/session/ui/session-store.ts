import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { useCondoScope } from '@/shared/lib/condo-scope';

import type { LoginResponse } from '../domain/login-response';
import type { Role } from '../domain/session';

export type PendingUser = { emailVerified: boolean };

type SessionState = {
  role: Role | null;
  subject: string | null;
  pendingUser: PendingUser | null;
  authenticate: (role: Role, subject: string | null) => void;
  switchView: (role: Role) => void;
  signOut: () => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      role: null,
      subject: null,
      pendingUser: null,
      authenticate: (role, subject) => set({ role, subject, pendingUser: null }),
      switchView: (role) => set({ role }),
      signOut: () => {
        set({ role: null, subject: null, pendingUser: null });
        useCondoScope.getState().setCondo(null);
      },
    }),
    {
      name: 'morada-session',
      partialize: (state) => ({
        role: state.role,
        subject: state.subject,
        pendingUser: state.pendingUser,
      }),
    },
  ),
);

export function applyLogin({ condos, emailVerified, invitedCondoId }: LoginResponse): Role | null {
  const first = condos.find((condo) => condo.id === invitedCondoId) ?? condos[0];
  if (!first) {
    useCondoScope.getState().setCondo(null);
    useSessionStore.setState({ role: null, subject: null, pendingUser: { emailVerified } });
    return null;
  }
  useCondoScope.getState().setCondo({
    id: first.id,
    name: first.name,
    condoRole: first.condoRole,
    permissions: first.permissions,
    hasHome: first.hasHome,
    organizationId: first.organizationId,
    orgRole: first.orgRole,
    onboardingPending: first.onboardingPending,
  });
  useSessionStore.getState().authenticate(first.role, null);
  return first.role;
}

export function restoreSession(): void {
  const { role, signOut, switchView } = useSessionStore.getState();
  const { condo } = useCondoScope.getState();
  if (!role) return;
  if (!condo) {
    signOut();
    return;
  }
  const isHomelessStaff = !condo.hasHome && condo.condoRole !== 'morador';
  if (role === 'resident' && isHomelessStaff) switchView('admin');
}
