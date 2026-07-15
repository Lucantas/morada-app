import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AccountEditScreen } from '@/features/accounts/ui/account-edit-screen';
import { AccountsScreen } from '@/features/accounts/ui/accounts-screen';
import { DashboardScreen } from '@/features/dashboard/ui/dashboard-screen';
import { unreadCount } from '@/features/messages/domain/unread-count';
import { AdminMessagesScreen } from '@/features/messages/ui/admin-messages-screen';
import { SupportScreen } from '@/features/messages/ui/support-screen';
import { ThreadScreen } from '@/features/messages/ui/thread-screen';
import { useThreads } from '@/features/messages/ui/use-threads';
import { NoticesScreen } from '@/features/notices/ui/notices-screen';
import { SendNoticeScreen } from '@/features/notices/ui/send-notice-screen';
import { PayScreen } from '@/features/receipts/ui/pay-screen';
import { ReceiptsScreen } from '@/features/receipts/ui/receipts-screen';
import { ResidentFinanceScreen } from '@/features/resident-home/ui/resident-finance-screen';
import { ResidentHomeScreen } from '@/features/resident-home/ui/resident-home-screen';
import { ResidentProfileScreen } from '@/features/resident-home/ui/resident-profile-screen';
import { LoginScreen } from '@/features/session/ui/login-screen';
import { useSessionStore } from '@/features/session/ui/session-store';
import { CreateLoginScreen } from '@/features/residents/ui/create-login-screen';
import { IssueChargeScreen } from '@/features/residents/ui/issue-charge-screen';
import { ResidentEditScreen } from '@/features/residents/ui/resident-edit-screen';
import { ResidentsScreen } from '@/features/residents/ui/residents-screen';
import { useCurrentResident } from '@/features/residents/ui/use-current-resident';
import { SettingsScreen } from '@/features/settings/ui/settings-screen';
import { BottomNav, type NavItem } from '@/shared/ui/bottom-nav';
import { AppShell, Screen, ScreenBody } from '@/shared/ui/app-shell';

import {
  accountRepository,
  confirmPayment,
  dashboardRepository,
  editReceipt,
  issueCharge,
  login,
  noticeRepository,
  overrideResidentStatus,
  provisionResidentLogin,
  receiptRepository,
  registerPayment,
  rejectPayment,
  residentRepository,
  settingsRepository,
  threadRepository,
} from './container';
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
};

const RESIDENT_TAB: Partial<Record<View, string>> = {
  'r-home': 'home',
  'r-receipts': 'receipts',
  'r-pay': 'receipts',
  'r-notices': 'notices',
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
  const role = useSessionStore((s) => s.role);
  const subject = useSessionStore((s) => s.subject);
  const signOut = useSessionStore((s) => s.signOut);
  const view = useNavStore((s) => s.view);
  const residentId = useNavStore((s) => s.residentId);
  const go = useNavStore((s) => s.go);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!role) {
    return (
      <LoginScreen
        pending={pending}
        error={loginError}
        onSubmit={(username, password) => {
          setPending(true);
          setLoginError(null);
          login(username, password)
            .then((r) => go(r === 'admin' ? 'a-home' : 'r-home'))
            .catch((err: unknown) =>
              setLoginError(err instanceof Error ? err.message : 'Não foi possível entrar.'),
            )
            .finally(() => setPending(false));
        }}
      />
    );
  }

  if (role === 'admin') {
    return <AdminRouter view={view} residentId={residentId} go={go} signOut={signOut} />;
  }
  return (
    <ResidentRouter
      view={view}
      residentId={residentId}
      subject={subject}
      go={go}
      signOut={signOut}
    />
  );
}

type RouteProps = {
  view: View;
  residentId?: string;
  subject?: string | null;
  go: (view: View, opts?: { residentId?: string }) => void;
  signOut: () => void;
};

function AdminRouter({ view, residentId, go, signOut }: RouteProps) {
  const threads = useThreads(threadRepository);
  const unread = unreadCount(threads.data ?? []);
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
          onCreateLogin={residentId ? () => go('a-resident-login', { residentId }) : undefined}
          onIssueCharge={residentId ? () => go('a-resident-charge', { residentId }) : undefined}
          registerPayment={registerPayment}
          onEditReceipt={editReceipt}
          onConfirmPayment={(receiptId) => confirmPayment({ receiptId })}
          onRejectPayment={rejectPayment}
          onOverrideStatus={overrideResidentStatus}
        />
      );
    case 'a-resident-login':
      return residentId !== undefined ? (
        <CreateLoginScreen
          residentId={residentId}
          provision={provisionResidentLogin}
          onBack={() => go('a-resident-edit', { residentId })}
        />
      ) : (
        <ResidentsScreen
          repository={residentRepository}
          onOpenResident={(id) => go('a-resident-edit', { residentId: id })}
          bottomNav={nav}
        />
      );
    case 'a-resident-charge':
      return residentId !== undefined ? (
        <IssueChargeScreen
          residentId={residentId}
          issue={issueCharge}
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
    case 'a-settings':
      return <SettingsScreen repository={settingsRepository} onBack={() => go('a-home')} />;
    case 'a-notice':
      return (
        <SendNoticeScreen
          repository={noticeRepository}
          onSent={() => go('a-home')}
          onBack={() => go('a-home')}
        />
      );
    case 'a-messages':
      return residentId === undefined ? (
        <AdminMessagesScreen
          repository={threadRepository}
          onOpenThread={(id) => go('a-messages', { residentId: id })}
          bottomNav={nav}
        />
      ) : (
        <ThreadScreen
          key={residentId}
          repository={threadRepository}
          threadId={residentId}
          onBack={() => go('a-messages')}
        />
      );
    case 'a-home':
    default:
      return (
        <DashboardScreen
          repository={dashboardRepository}
          onSendNotice={() => go('a-notice')}
          onOpenMessages={() => go('a-messages')}
          onSeeAccounts={() => go('a-accounts')}
          unreadCount={unread}
          bottomNav={nav}
        />
      );
  }
}

function ResidentRouter({ view, residentId, subject, go, signOut }: RouteProps) {
  const currentResident = useCurrentResident(residentRepository, subject ?? null);
  const nav = <BottomNav items={residentNav(view, go)} />;

  if (currentResident.isPending) {
    return <StatusScreen message="Carregando…" bottomNav={nav} />;
  }
  if (currentResident.isError || !currentResident.data) {
    return <StatusScreen message="Não foi possível carregar seus dados." bottomNav={nav} />;
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
    case 'r-help':
      return (
        <SupportScreen repository={threadRepository} threadId={subject ?? 'r-1'} bottomNav={nav} />
      );
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
        />
      );
  }
}

function StatusScreen({ message, bottomNav }: { message: string; bottomNav: ReactNode }) {
  return (
    <Screen>
      <ScreenBody>
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '60%' }}>
          <p style={{ color: 'var(--ink-500)' }}>{message}</p>
        </div>
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
    {
      key: 'settings',
      label: 'Config.',
      icon: 'wrench',
      active: active === 'settings',
      onClick: () => go('a-settings'),
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
      key: 'notices',
      label: 'Avisos',
      icon: 'bell',
      active: active === 'notices',
      onClick: () => go('r-notices'),
    },
    {
      key: 'help',
      label: 'Ajuda',
      icon: 'message',
      active: active === 'help',
      onClick: () => go('r-help'),
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
