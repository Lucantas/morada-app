import { create } from 'zustand';

import type { Role } from '../domain/session';

type SessionState = {
  role: Role | null;
  token: string | null;
  subject: string | null;
  authenticate: (role: Role, token: string, subject: string | null) => void;
  signOut: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  role: null,
  token: null,
  subject: null,
  authenticate: (role, token, subject) => set({ role, token, subject }),
  signOut: () => set({ role: null, token: null, subject: null }),
}));
