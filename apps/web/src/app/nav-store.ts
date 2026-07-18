import { create } from 'zustand';

export type View =
  | 'a-home'
  | 'a-residents'
  | 'a-resident-edit'
  | 'a-resident-login'
  | 'a-accounts'
  | 'a-account-edit'
  | 'a-income-edit'
  | 'a-settings'
  | 'a-notice'
  | 'a-messages'
  | 'r-home'
  | 'r-receipts'
  | 'r-pay'
  | 'r-finance'
  | 'r-notices'
  | 'r-profile'
  | 'r-help';

export type NavSnapshot = {
  view: View;
  residentId?: string;
  incomeId?: string;
};

type NavState = NavSnapshot & {
  go: (view: View, opts?: { residentId?: string; incomeId?: string }) => void;
  restore: (snapshot: NavSnapshot) => void;
};

export const useNavStore = create<NavState>((set) => ({
  view: 'a-home',
  residentId: undefined,
  incomeId: undefined,
  go: (view, opts) => set({ view, residentId: opts?.residentId, incomeId: opts?.incomeId }),
  restore: (snapshot) =>
    set({
      view: snapshot.view,
      residentId: snapshot.residentId,
      incomeId: snapshot.incomeId,
    }),
}));
