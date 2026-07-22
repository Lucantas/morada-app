import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
      signOut: () => set({ role: null, subject: null }),
    }),
    {
      name: 'morada-session',
      partialize: (state) => ({ role: state.role, subject: state.subject }),
    },
  ),
);
