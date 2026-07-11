import { create } from 'zustand';

import type { Role } from '../domain/session';

type SessionState = {
  role: Role | null;
  signInAs: (role: Role) => void;
  signOut: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  role: null,
  signInAs: (role) => set({ role }),
  signOut: () => set({ role: null }),
}));
