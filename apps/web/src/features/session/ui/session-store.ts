import { create } from 'zustand';

import type { Role } from '../domain/session';

type SessionState = {
  role: Role | null;
  token: string | null;
  signInAs: (role: Role) => void;
  authenticate: (role: Role, token: string) => void;
  signOut: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  role: null,
  token: null,
  signInAs: (role) => set({ role, token: null }),
  authenticate: (role, token) => set({ role, token }),
  signOut: () => set({ role: null, token: null }),
}));
