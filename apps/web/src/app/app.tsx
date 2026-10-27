import { useCallback, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';

import { AccountEditScreen } from '@/features/accounts/ui/account-edit-screen';
import { AccountsScreen } from '@/features/accounts/ui/accounts-screen';
import { incomeMonthlyTotals } from '@/features/income/domain/income-totals';
import { IncomeEditScreen } from '@/features/income/ui/income-edit-screen';
import { IncomeSection } from '@/features/income/ui/income-section';
import { useIncomes } from '@/features/income/ui/use-income';
import { DashboardScreen } from '@/features/dashboard/ui/dashboard-screen';
import { NoticesScreen } from '@/features/notices/ui/notices-screen';
import { SendNoticeScreen } from '@/features/notices/ui/send-notice-screen';
import {
  mergeMonthlyTotals,
  paidReceiptMonthlyTotals,
} from '@/features/receipts/domain/receipt-income-totals';
import { PayScreen } from '@/features/receipts/ui/pay-screen';
import { ReceiptsScreen } from '@/features/receipts/ui/receipts-screen';
import { useReceipts } from '@/features/receipts/ui/use-receipts';
import { ResidentFinanceScreen } from '@/features/resident-home/ui/resident-finance-screen';
import { ResidentHomeScreen } from '@/features/resident-home/ui/resident-home-screen';
import { ResidentProfileScreen } from '@/features/resident-home/ui/resident-profile-screen';
import { useSessionStore } from '@/features/session/ui/session-store';
import type { Role } from '@/features/session/domain/session';
import { ViewSwitch } from '@/features/session/ui/view-switch';
import { InviteForm } from '@/features/invitations/ui/invite-form';
import { clearDraft } from '@/features/onboarding/data/local-draft-store';
import { OnboardingFlow } from '@/features/onboarding/ui/onboarding-flow';
import { BuildingView } from '@/features/building/ui/building-view';
import { ResidentAccessCard } from '@/features/invitations/ui/resident-access-card';
import { InviteShare } from '@/features/invitations/ui/invite-share';
import { SindicoScreen } from '@/features/invitations/ui/sindico-screen';
import { ResidentAccessScreen } from '@/features/invitations/ui/resident-access-screen';
import { ResidentEditScreen } from '@/features/residents/ui/resident-edit-screen';
import { ResidentsScreen } from '@/features/residents/ui/residents-screen';
import { residentsQueryKey } from '@/features/residents/ui/use-residents';
import { useCurrentResident } from '@/features/residents/ui/use-current-resident';
import { useCondoInfo, useRenameCondo } from '@/features/condos/ui/use-condo-info';
import { ActivityScreen } from '@/features/activity/ui/activity-screen';
import { TeamScreen } from '@/features/team/ui/team-screen';
import { SettingsScreen } from '@/features/settings/ui/settings-screen';
import { useSettings } from '@/features/settings/ui/use-settings';
import { useCategories, useSaveCategories } from '@/features/categories/ui/use-categories';
import { useCanDo, useCondoScope } from '@/shared/lib/condo-scope';
import { BottomNav, type NavItem } from '@/shared/ui/bottom-nav';
import { AppShell, Screen, ScreenBody } from '@/shared/ui/app-shell';
import { StatusView } from '@/shared/ui/status-view';

import {
  accountRepository,
  activityRepository,
  buildingRepository,
  categoryRepository,
  condoInfoRepository,
  confirmPayment,
  dashboardRepository,
  editReceipt,
  ensureMonthlyReceipts,
  incomeRepository,
  invitationRepository,
  issueCharge,
  logout,
  noticeRepository,
  onboardingRepository,
  overrideResidentStatus,
  pixRepository,
  receiptRepository,
  registerPayment,
  rejectPayment,
  residentRepository,
  settingsRepository,
  teamRepository,
  authRepository,
} from './container';
import { EntryRouter } from './entry-router';
import { useNavStore, type View } from './nav-store';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

const ADMIN_TAB: Partial<Record<View, string>> = {
  'a-home': 'home',
  'a-residents': 'residents',
  'a-resident-edit': 'residents',
  'a-accounts': 'accounts',
  'a-account-edit': 'accounts',
  'a-settings': 'settings',
  'a-activity': 'settings',
  'a-sindico': 'settings',
  'a-team': 'settings',
};

const RESIDENT_TAB: Partial<Record<View, string>> = {
  'r-home': 'home',
  'r-receipts': 'receipts',
  'r-pay': 'receipts',
  'r-finance': 'condominio',
  'r-help': 'help',
  'r-profile': 'profile',
};

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell>
        <Router />
      </AppShell>
    </QueryClientProvider>
  );
}

function Router() {
  const go = useNavStore((s) => s.go);
  const queryClient = useQueryClient();

  const handleSignOut = useCallback(() => {
    clearDraft();
    queryClient.clear();
    void logout();
  }, [queryClient]);

  return (
    <EntryRouter
      repository={authRepository}
      invitations={invitationRepository}
      onLanded={(role) => go(role === 'admin' ? 'a-home' : 'r-home')}
      onSignOut={handleSignOut}
    >
      <SessionRouter signOut={handleSignOut} />
    </EntryRouter>
  );
}

function SessionRouter({ signOut }: { signOut: () => void }) {
  const role = useSessionStore((s) => s.role);
  const condoId = useCondoScope((s) => s.condo?.id ?? null);
  const view = useNavStore((s) => s.view);
  const residentId = useNavStore((s) => s.residentId);
  const incomeId = useNavStore((s) => s.incomeId);
  const go = useNavStore((s) => s.go);
  const queryClient = useQueryClient();
  const switchView = useSessionStore((s) => s.switchView);
  const onboardingPending = useCondoScope((s) => s.condo?.onboardingPending ?? false);
  const canManageCondo = useCanDo('manage_condo');

  const handleSwitch = useCallback(
    (next: Role) => {
      queryClient.clear();
      switchView(next);
      go(next === 'admin' ? 'a-home' : 'r-home');
    },
    [queryClient, switchView, go],
  );
  const headerAction = <ViewSwitch onSwitch={handleSwitch} />;

  if (role === 'admin' && onboardingPending && canManageCondo) {
    return <AdminOnboarding onDone={() => go('a-home')} />;
  }
  if (role === 'admin') {
    return (
      <AdminRouter
        view={view}
        residentId={residentId}
        incomeId={incomeId}
        go={go}
        signOut={signOut}
        headerAction={headerAction}
      />
    );
  }
  return (
    <ResidentRouter
      view={view}
      residentId={residentId}
      condoId={condoId}
      go={go}
      signOut={signOut}
      headerAction={headerAction}
    />
  );
}

function AdminOnboarding({ onDone }: { onDone: () => void }) {
  return (
    <OnboardingFlow
      building={buildingRepository}
      categories={categoryRepository}
      accounts={accountRepository}
      settings={settingsRepository}
      residents={residentRepository}
      invitations={invitationRepository}
      onboarding={onboardingRepository}
      onDone={onDone}
      buildingView={BuildingView}
      accessCard={ResidentAccessCard}
    />
  );
}

type RouteProps = {
  view: View;
  residentId?: string;
  incomeId?: string;
  condoId?: string | null;
  go: (view: View, opts?: { residentId?: string; incomeId?: string }) => void;
  signOut: () => void;
  headerAction?: ReactNode;
};

function AdminRouter({ view, residentId, incomeId, go, signOut, headerAction }: RouteProps) {
  const settings = useSettings(settingsRepository);
  const dueDay = settings.data?.dueDay ?? 15;
  const defaultReceiptValueCents = settings.data?.monthlyFeeCents ?? 0;
  const incomes = useIncomes(incomeRepository);
  const receipts = useReceipts(receiptRepository);
  const monthlyIncomeCents = mergeMonthlyTotals(
    incomeMonthlyTotals(incomes.data ?? []),
    paidReceiptMonthlyTotals(receipts.data ?? []),
  );
  const queryClient = useQueryClient();
  const ensureMonthly = useCallback(async () => {
    await ensureMonthlyReceipts();
    await queryClient.invalidateQueries({ queryKey: residentsQueryKey });
  }, [queryClient]);
  const nav = <BottomNav items={adminNav(view, go, signOut)} />;
  switch (view) {
    case 'a-residents':
      return (
        <ResidentsScreen
          repository={residentRepository}
          onOpenResident={(id) => go('a-resident-edit', { residentId: id })}
          bottomNav={nav}
        />
      );
    case 'a-resident-edit':
      return (
        <ResidentEditScreen
          repository={residentRepository}
          receiptRepository={receiptRepository}
          residentId={residentId}
          onBack={() => go('a-residents')}
          onOpenAccess={residentId ? () => go('a-resident-login', { residentId }) : undefined}
          dueDay={dueDay}
          defaultReceiptValueCents={defaultReceiptValueCents}
          issueCharge={issueCharge}
          registerPayment={registerPayment}
          onEditReceipt={editReceipt}
          onConfirmPayment={(receiptId, paidAt) => confirmPayment({ receiptId, paidAt })}
          onRejectPayment={rejectPayment}
          onOverrideStatus={overrideResidentStatus}
        />
      );
    case 'a-resident-login':
      return residentId !== undefined ? (
        <ResidentAccessScreen
          residentId={residentId}
          repository={invitationRepository}
          residents={residentRepository}
          onBack={() => go('a-resident-edit', { residentId })}
        />
      ) : (
        <ResidentsScreen
          repository={residentRepository}
          onOpenResident={(id) => go('a-resident-edit', { residentId: id })}
          bottomNav={nav}
        />
      );
    case 'a-accounts':
      return (
        <AccountsScreen
          repository={accountRepository}
          onOpenAccount={(id) => go('a-account-edit', { residentId: id })}
          incomeSection={
            <IncomeSection
              repository={incomeRepository}
              onOpenIncome={(id) => go('a-income-edit', id ? { incomeId: id } : undefined)}
            />
          }
          monthlyIncomeCents={monthlyIncomeCents}
          bottomNav={nav}
        />
      );
    case 'a-account-edit':
      return (
        <AccountEditScreen
          repository={accountRepository}
          accountId={residentId}
          onBack={() => go('a-accounts')}
        />
      );
    case 'a-income-edit':
      return (
        <IncomeEditScreen
          repository={incomeRepository}
          incomeId={incomeId}
          onBack={() => go('a-accounts')}
        />
      );
    case 'a-settings':
      return (
        <AdminSettings
          onBack={() => go('a-home')}
          onOpenActivity={() => go('a-activity')}
          onOpenSindico={() => go('a-sindico')}
          onOpenTeam={() => go('a-team')}
        />
      );
    case 'a-sindico':
      return <SindicoScreen repository={invitationRepository} onBack={() => go('a-settings')} />;
    case 'a-team':
      return (
        <TeamScreen
          repository={teamRepository}
          inviteForm={InviteForm}
          inviteShare={InviteShare}
          onBack={() => go('a-settings')}
        />
      );
    case 'a-activity':
      return <ActivityScreen repository={activityRepository} onBack={() => go('a-settings')} />;
    case 'a-notice':
      return (
        <SendNoticeScreen
          repository={noticeRepository}
          onSent={() => go('a-home')}
          onBack={() => go('a-home')}
        />
      );
    case 'a-home':
    default:
      return (
        <DashboardScreen
          repository={dashboardRepository}
          onSendNotice={() => go('a-notice')}
          onSeeAccounts={() => go('a-accounts')}
          onOpenSettings={() => go('a-settings')}
          bottomNav={nav}
          headerAction={headerAction}
          ensureMonthlyReceipts={ensureMonthly}
        />
      );
  }
}

function AdminSettings({
  onBack,
  onOpenActivity,
  onOpenSindico,
  onOpenTeam,
}: {
  onBack: () => void;
  onOpenActivity: () => void;
  onOpenSindico: () => void;
  onOpenTeam: () => void;
}) {
  const categories = useCategories(categoryRepository);
  const saveCategories = useSaveCategories(categoryRepository);
  const condoInfo = useCondoInfo(condoInfoRepository);
  const renameCondo = useRenameCondo(condoInfoRepository);
  const canManageFees = useCanDo('manage_fees');
  const canManageCondo = useCanDo('manage_condo');
  const canViewActivity = useCanDo('view_activity');
  const isOrgOwner = useCondoScope((s) => s.condo?.orgRole === 'owner');
  return (
    <SettingsScreen
      repository={settingsRepository}
      condoName={condoInfo.data?.name}
      savingCondoName={renameCondo.isPending}
      onRenameCondo={(name) => renameCondo.mutateAsync(name)}
      categories={categories.data}
      categoriesError={categories.isError}
      categoriesReady={categories.isSuccess}
      savingCategories={saveCategories.isPending}
      onSaveCategories={(drafts) => saveCategories.mutateAsync(drafts)}
      canManageFees={canManageFees}
      canManageCondo={canManageCondo}
      onOpenSindico={canManageCondo ? onOpenSindico : undefined}
      onOpenTeam={isOrgOwner ? onOpenTeam : undefined}
      onOpenActivity={canViewActivity ? onOpenActivity : undefined}
      onBack={onBack}
    />
  );
}

function ResidentRouter({ view, residentId, condoId, go, signOut, headerAction }: RouteProps) {
  const currentResident = useCurrentResident(residentRepository, condoId ?? null);
  const nav = <BottomNav items={residentNav(view, go)} />;

  if (currentResident.isPending) {
    return <StatusScreen message="Carregando…" bottomNav={nav} />;
  }
  if (currentResident.isError || !currentResident.data) {
    return (
      <StatusScreen
        variant="error"
        message="Não foi possível carregar seus dados."
        bottomNav={nav}
      />
    );
  }
  const resident = currentResident.data;

  switch (view) {
    case 'r-receipts':
      return (
        <ReceiptsScreen
          repository={receiptRepository}
          resident={resident}
          onPay={(id) => go('r-pay', { residentId: id })}
          bottomNav={nav}
        />
      );
    case 'r-pay':
      return residentId !== undefined ? (
        <PayScreen
          repository={receiptRepository}
          pixRepository={pixRepository}
          receiptId={residentId}
          onDone={() => go('r-receipts')}
        />
      ) : (
        <ReceiptsScreen
          repository={receiptRepository}
          resident={resident}
          onPay={(id) => go('r-pay', { residentId: id })}
          bottomNav={nav}
        />
      );
    case 'r-notices':
      return <NoticesScreen repository={noticeRepository} bottomNav={nav} />;
    case 'r-finance':
      return <ResidentFinanceScreen dashboardRepository={dashboardRepository} bottomNav={nav} />;
    case 'r-profile':
      return <ResidentProfileScreen resident={resident} onSignOut={signOut} bottomNav={nav} />;
    case 'r-home':
    default:
      return (
        <ResidentHomeScreen
          receiptRepository={receiptRepository}
          resident={resident}
          onGoReceipts={() => go('r-receipts')}
          onGoFinance={() => go('r-finance')}
          onGoNotices={() => go('r-notices')}
          bottomNav={nav}
          headerAction={headerAction}
        />
      );
  }
}

function StatusScreen({
  message,
  bottomNav,
  variant = 'loading',
}: {
  message: string;
  bottomNav: ReactNode;
  variant?: 'loading' | 'error';
}) {
  return (
    <Screen>
      <ScreenBody>
        <StatusView variant={variant} message={message} />
      </ScreenBody>
      {bottomNav}
    </Screen>
  );
}

function adminNav(view: View, go: (v: View) => void, signOut: () => void): NavItem[] {
  const active = ADMIN_TAB[view];
  return [
    {
      key: 'home',
      label: 'Início',
      icon: 'home',
      active: active === 'home',
      onClick: () => go('a-home'),
    },
    {
      key: 'residents',
      label: 'Apartamentos',
      icon: 'residents',
      active: active === 'residents',
      onClick: () => go('a-residents'),
    },
    {
      key: 'accounts',
      label: 'Contas',
      icon: 'receipt',
      active: active === 'accounts',
      onClick: () => go('a-accounts'),
    },
    { key: 'logout', label: 'Sair', icon: 'logout', onClick: signOut },
  ];
}

function residentNav(view: View, go: (v: View) => void): NavItem[] {
  const active = RESIDENT_TAB[view];
  return [
    {
      key: 'home',
      label: 'Início',
      icon: 'home',
      active: active === 'home',
      onClick: () => go('r-home'),
    },
    {
      key: 'receipts',
      label: 'Recibos',
      icon: 'receipt',
      active: active === 'receipts',
      onClick: () => go('r-receipts'),
    },
    {
      key: 'condominio',
      label: 'Condomínio',
      icon: 'building',
      active: active === 'condominio',
      onClick: () => go('r-finance'),
    },
    {
      key: 'profile',
      label: 'Perfil',
      icon: 'profile',
      active: active === 'profile',
      onClick: () => go('r-profile'),
    },
  ];
}
