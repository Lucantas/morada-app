import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { useCondoScope, type CurrentCondo } from '@/shared/lib/condo-scope';

import type { LoginCondo, LoginResponse } from '../domain/login-response';
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
        useCondoScope.getState().setAtStreet(false);
        useCondoScope.getState().setCondoCount(1);
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

function toCurrentCondo(condo: LoginCondo): CurrentCondo {
  return {
    id: condo.id,
    name: condo.name,
    condoRole: condo.condoRole,
    permissions: condo.permissions,
    hasHome: condo.hasHome,
    organizationId: condo.organizationId,
    orgRole: condo.orgRole,
    onboardingPending: condo.onboardingPending,
  };
}

export function applyLogin({ condos, emailVerified, invitedCondoId }: LoginResponse): Role | null {
  const first = condos.find((condo) => condo.id === invitedCondoId) ?? condos[0];
  if (!first) {
    useCondoScope.getState().setCondo(null);
    useSessionStore.setState({ role: null, subject: null, pendingUser: { emailVerified } });
    return null;
  }
  const scope = useCondoScope.getState();
  scope.setCondoCount(condos.length);
  scope.setAtStreet(condos.length > 1 && !invitedCondoId);
  scope.setCondo(toCurrentCondo(first));
  useSessionStore.getState().authenticate(first.role, null);
  return first.role;
}

export function enterCondo(condo: LoginCondo): Role {
  const scope = useCondoScope.getState();
  scope.setCondo(toCurrentCondo(condo));
  scope.setAtStreet(false);
  useSessionStore.getState().authenticate(condo.role, null);
  return condo.role;
}

export function goToStreet(): void {
  useCondoScope.getState().setAtStreet(true);
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
