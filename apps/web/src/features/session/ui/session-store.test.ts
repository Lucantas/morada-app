import { act } from '@testing-library/react';

import { useCondoScope } from '@/shared/lib/condo-scope';

import { testCondo } from '@/test/condo';
import { loginCondo } from '@/test/factories.auth';

import { applyLogin, restoreSession, useSessionStore } from './session-store';

describe('useSessionStore', () => {
  afterEach(() => act(() => useSessionStore.getState().signOut()));

  test('starts signed out', () => {
    expect(useSessionStore.getState().role).toBeNull();
  });

  test('authenticate stores role and subject without a token', () => {
    act(() => useSessionStore.getState().authenticate('admin', 'admin'));
    const state = useSessionStore.getState();
    expect(state.role).toBe('admin');
    expect(state.subject).toBe('admin');
    expect('token' in state).toBe(false);
  });

  test('switchView changes only the role', () => {
    act(() => useSessionStore.getState().authenticate('admin', 'u-1'));
    act(() => useSessionStore.getState().switchView('resident'));

    expect(useSessionStore.getState()).toMatchObject({ role: 'resident', subject: 'u-1' });
  });

  test('signOut clears role and subject', () => {
    act(() => useSessionStore.getState().authenticate('resident', 'r-1'));
    act(() => useSessionStore.getState().signOut());
    expect(useSessionStore.getState()).toMatchObject({ role: null, subject: null });
  });
});

describe('condo-aware session', () => {
  afterEach(() => {
    act(() => useSessionStore.getState().signOut());
    act(() => useCondoScope.getState().setCondo(null));
  });

  test('login stores the first condo and its role', () => {
    const role = applyLogin({
      condos: [
        loginCondo({ role: 'resident', condoRole: 'morador', permissions: [] }),
        loginCondo({ id: 'c2', name: 'Outro' }),
      ],
      emailVerified: true,
    });

    expect(role).toBe('resident');
    expect(useSessionStore.getState().role).toBe('resident');
    expect(useCondoScope.getState().condo).toMatchObject({
      id: 'c1',
      name: 'Morada',
      condoRole: 'morador',
      hasHome: false,
    });
  });

  test('login lands on the invited condo when it is among the condos', () => {
    const role = applyLogin({
      condos: [
        loginCondo({ role: 'resident', condoRole: 'morador', permissions: [] }),
        loginCondo({ id: 'c2', name: 'Outro', condoRole: 'sindico' }),
      ],
      emailVerified: true,
      invitedCondoId: 'c2',
    });

    expect(role).toBe('admin');
    expect(useCondoScope.getState().condo).toMatchObject({ id: 'c2', condoRole: 'sindico' });
  });

  test('login falls back to the first condo when the invited one is not listed', () => {
    applyLogin({
      condos: [loginCondo(), loginCondo({ id: 'c2', name: 'Outro' })],
      emailVerified: true,
      invitedCondoId: 'c-missing',
    });

    expect(useCondoScope.getState().condo?.id).toBe('c1');
  });

  test('login falls back to the first condo when no condo was invited', () => {
    applyLogin({
      condos: [loginCondo(), loginCondo({ id: 'c2', name: 'Outro' })],
      emailVerified: true,
      invitedCondoId: null,
    });

    expect(useCondoScope.getState().condo?.id).toBe('c1');
  });

  test('signOut clears the condo', () => {
    applyLogin({ condos: [loginCondo()], emailVerified: true });
    act(() => useSessionStore.getState().signOut());
    expect(useCondoScope.getState().condo).toBeNull();
  });

  test('signOut never exposes a role without a condo', () => {
    applyLogin({
      condos: [loginCondo({ role: 'resident', condoRole: 'morador', permissions: [] })],
      emailVerified: true,
    });
    const seen: { role: string | null; condo: unknown }[] = [];
    const record = () =>
      seen.push({
        role: useSessionStore.getState().role,
        condo: useCondoScope.getState().condo,
      });
    const stops = [useSessionStore.subscribe(record), useCondoScope.subscribe(record)];

    act(() => useSessionStore.getState().signOut());
    stops.forEach((stop) => stop());

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.some((state) => state.role !== null && state.condo === null)).toBe(false);
  });

  test('login with condos keeps no pending user', () => {
    applyLogin({ condos: [], emailVerified: false });

    applyLogin({ condos: [loginCondo()], emailVerified: true });

    expect(useSessionStore.getState().pendingUser).toBeNull();
  });

  test('login with zero condos stores an unverified pending user and no role', () => {
    const role = applyLogin({ condos: [], emailVerified: false });

    expect(role).toBeNull();
    expect(useSessionStore.getState()).toMatchObject({
      role: null,
      pendingUser: { emailVerified: false },
    });
    expect(useCondoScope.getState().condo).toBeNull();
  });

  test('login with zero condos stores a verified pending user', () => {
    applyLogin({ condos: [], emailVerified: true });

    expect(useSessionStore.getState().pendingUser).toEqual({ emailVerified: true });
  });

  test('signOut clears the pending user', () => {
    applyLogin({ condos: [], emailVerified: false });

    act(() => useSessionStore.getState().signOut());

    expect(useSessionStore.getState().pendingUser).toBeNull();
  });

  test('the pending user survives a reload', () => {
    applyLogin({ condos: [], emailVerified: false });

    const persisted = JSON.parse(window.localStorage.getItem('morada-session') ?? '{}') as {
      state?: unknown;
    };

    expect(persisted.state).toMatchObject({ pendingUser: { emailVerified: false } });
  });

  test('boot with a session but no condo signs out', () => {
    act(() => useSessionStore.getState().authenticate('admin', null));
    act(() => useCondoScope.getState().setCondo(null));

    restoreSession();

    expect(useSessionStore.getState().role).toBeNull();
  });

  test.each(['administrador', 'sindico'] as const)(
    'boot as resident without a home corrects a %s to the staff view',
    (condoRole) => {
      act(() => useCondoScope.getState().setCondo(testCondo({ condoRole, hasHome: false })));
      act(() => useSessionStore.getState().authenticate('resident', null));

      restoreSession();

      expect(useSessionStore.getState().role).toBe('admin');
    },
  );

  test('boot as resident keeps the resident view of a staff person with a home', () => {
    act(() =>
      useCondoScope.getState().setCondo(testCondo({ condoRole: 'sindico', hasHome: true })),
    );
    act(() => useSessionStore.getState().authenticate('resident', null));

    restoreSession();

    expect(useSessionStore.getState().role).toBe('resident');
  });

  test('boot as resident keeps a morador in the resident view', () => {
    act(() =>
      useCondoScope
        .getState()
        .setCondo(testCondo({ condoRole: 'morador', permissions: [], hasHome: false })),
    );
    act(() => useSessionStore.getState().authenticate('resident', null));

    restoreSession();

    expect(useSessionStore.getState().role).toBe('resident');
  });

  test('boot with a session and a condo keeps the session', () => {
    applyLogin({ condos: [loginCondo()], emailVerified: true });

    restoreSession();

    expect(useSessionStore.getState().role).toBe('admin');
  });
});
