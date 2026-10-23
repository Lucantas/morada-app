import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { AuthRepository } from '@/features/auth/domain/auth-repository';
import { loginErrorMessage } from '@/features/auth/ui/auth-error-message';
import { ConfirmEmailScreen } from '@/features/auth/ui/confirm-email-screen';
import { CreateCondoScreen } from '@/features/auth/ui/create-condo-screen';
import { ForgotPasswordScreen } from '@/features/auth/ui/forgot-password-screen';
import { PendingConfirmationScreen } from '@/features/auth/ui/pending-confirmation-screen';
import { ResetPasswordScreen } from '@/features/auth/ui/reset-password-screen';
import { SignUpScreen } from '@/features/auth/ui/signup-screen';
import type { InvitationRepository } from '@/features/invitations/domain/invitation-repository';
import { AcceptInviteScreen } from '@/features/invitations/ui/accept-invite-screen';
import type { LoginResponse } from '@/features/session/domain/login-response';
import type { Role } from '@/features/session/domain/session';
import { LoginScreen } from '@/features/session/ui/login-screen';
import { applyLogin, useSessionStore } from '@/features/session/ui/session-store';
import { clearPublicRoute, parsePublicRoute, type PublicRoute } from '@/shared/lib/public-route';

type Entry = 'login' | 'signup' | 'forgot';

type Props = {
  repository: AuthRepository;
  invitations: InvitationRepository;
  onLanded: (role: Role) => void;
  onSignOut: () => void;
  children: ReactNode;
};

function usePublicRoute() {
  const [route, setRoute] = useState<PublicRoute | null>(() =>
    parsePublicRoute(window.location.hash),
  );
  useEffect(() => {
    const onHashChange = () => setRoute(parsePublicRoute(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => {
    if (route?.kind === 'convite') clearPublicRoute();
  }, [route]);
  const leave = useCallback(() => {
    clearPublicRoute();
    setRoute(null);
  }, []);
  return { route, leave };
}

export function EntryRouter({ repository, invitations, onLanded, onSignOut, children }: Props) {
  const role = useSessionStore((s) => s.role);
  const pendingUser = useSessionStore((s) => s.pendingUser);
  const queryClient = useQueryClient();
  const publicRoute = usePublicRoute();
  const [entry, setEntryState] = useState<Entry>('login');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [invitedCondo, setInvitedCondo] = useState<string | null>(null);

  const setEntry = useCallback((next: Entry) => {
    setLoginError(null);
    setEntryState(next);
  }, []);

  const leavePublicRoute = (next: Entry) => {
    publicRoute.leave();
    setEntry(next);
  };

  const enter = (response: LoginResponse) => {
    publicRoute.leave();
    setEntry('login');
    setInvitedCondo(null);
    queryClient.clear();
    const landed = applyLogin(response);
    if (landed) onLanded(landed);
  };

  const { route } = publicRoute;

  if (route?.kind === 'convite') {
    return (
      <AcceptInviteScreen
        key={route.token}
        token={route.token}
        repository={invitations}
        onAccepted={(response, condoName) => {
          enter(response);
          setInvitedCondo(condoName);
        }}
        onSignIn={() => leavePublicRoute('login')}
      />
    );
  }

  if (route?.kind === 'confirmar-email') {
    return (
      <ConfirmEmailScreen
        key={route.token}
        token={route.token}
        repository={repository}
        onLoggedIn={enter}
        onSignIn={() => leavePublicRoute('login')}
        onForgotPassword={() => leavePublicRoute('forgot')}
      />
    );
  }

  if (route?.kind === 'redefinir-senha') {
    return (
      <ResetPasswordScreen
        key={route.token}
        token={route.token}
        repository={repository}
        onLoggedIn={enter}
        onRequestNewLink={() => leavePublicRoute('forgot')}
      />
    );
  }

  if (role) return children;

  if (pendingUser) {
    return pendingUser.emailVerified ? (
      <CreateCondoScreen
        repository={repository}
        onCreated={(condo) => enter({ condos: [condo], emailVerified: true })}
        onSignOut={onSignOut}
      />
    ) : (
      <PendingConfirmationScreen
        repository={repository}
        onSignOut={onSignOut}
        condoName={invitedCondo ?? undefined}
      />
    );
  }

  if (entry === 'signup') {
    return <SignUpScreen repository={repository} onBack={() => setEntry('login')} />;
  }
  if (entry === 'forgot') {
    return <ForgotPasswordScreen repository={repository} onBack={() => setEntry('login')} />;
  }
  return (
    <LoginScreen
      pending={pending}
      error={loginError}
      onSignUp={() => setEntry('signup')}
      onForgotPassword={() => setEntry('forgot')}
      onSubmit={(login, password) => {
        setPending(true);
        setLoginError(null);
        repository
          .login(login, password)
          .then(enter)
          .catch((err: unknown) => setLoginError(loginErrorMessage(err)))
          .finally(() => setPending(false));
      }}
    />
  );
}
