import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { LoginScreen } from '@/features/session/ui/login-screen';
import { useSessionStore } from '@/features/session/ui/session-store';
import { ResidentEditScreen } from '@/features/residents/ui/resident-edit-screen';
import { ResidentsScreen } from '@/features/residents/ui/residents-screen';
import { BottomNav, type NavItem } from '@/shared/ui/bottom-nav';
import { PhoneFrame } from '@/shared/ui/phone-frame';

import { ComingSoon } from './coming-soon';
import { residentRepository } from './container';
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
};

const RESIDENT_TAB: Partial<Record<View, string>> = {
  'r-home': 'home',
  'r-receipts': 'receipts',
  'r-finance': 'finance',
  'r-profile': 'profile',
};

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PhoneFrame>
        <Router />
      </PhoneFrame>
    </QueryClientProvider>
  );
}

function Router() {
  const role = useSessionStore((s) => s.role);
  const signInAs = useSessionStore((s) => s.signInAs);
  const signOut = useSessionStore((s) => s.signOut);
  const view = useNavStore((s) => s.view);
  const residentId = useNavStore((s) => s.residentId);
  const go = useNavStore((s) => s.go);

  if (!role) {
    return (
      <LoginScreen
        onEnter={(r) => {
          signInAs(r);
          go(r === 'admin' ? 'a-home' : 'r-receipts');
        }}
      />
    );
  }

  if (role === 'admin') {
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
            residentId={residentId}
            onBack={() => go('a-residents')}
          />
        );
      case 'a-accounts':
        return <ComingSoon title="Contas" bottomNav={nav} />;
      default:
        return <ComingSoon title="Painel do administrador" bottomNav={nav} />;
    }
  }

  const nav = <BottomNav items={residentNav(view, go)} />;
  return <ComingSoon title="Meus recibos" bottomNav={nav} />;
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
      label: 'Moradores',
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
      key: 'finance',
      label: 'Condomínio',
      icon: 'building',
      active: active === 'finance',
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
