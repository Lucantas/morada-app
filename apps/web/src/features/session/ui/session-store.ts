import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { isJwtActive } from '@/shared/lib/jwt';

import type { Role } from '../domain/session';

type SessionState = {
  role: Role | null;
  token: string | null;
  subject: string | null;
  authenticate: (role: Role, token: string, subject: string | null) => void;
  signOut: () => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      role: null,
      token: null,
      subject: null,
      authenticate: (role, token, subject) => set({ role, token, subject }),
      signOut: () => set({ role: null, token: null, subject: null }),
    }),
    {
      name: 'morada-session',
      partialize: (state) => ({ role: state.role, token: state.token, subject: state.subject }),
      // On reload, discard a session whose token has expired so the user is sent
      // to login instead of a broken, half-authenticated state.
      onRehydrateStorage: () => (state) => {
        if (state?.token && !isJwtActive(state.token)) state.signOut();
      },
    },
  ),
);
