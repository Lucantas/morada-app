import { create } from 'zustand';

export type View =
  | 'a-home'
  | 'a-residents'
  | 'a-resident-edit'
  | 'a-accounts'
  | 'a-account-edit'
  | 'a-notice'
  | 'a-messages'
  | 'r-home'
  | 'r-receipts'
  | 'r-pay'
  | 'r-finance'
  | 'r-notices'
  | 'r-profile'
  | 'r-help';

type NavState = {
  view: View;
  residentId?: string;
  go: (view: View, opts?: { residentId?: string }) => void;
};

export const useNavStore = create<NavState>((set) => ({
  view: 'a-home',
  residentId: undefined,
  go: (view, opts) => set({ view, residentId: opts?.residentId }),
}));
