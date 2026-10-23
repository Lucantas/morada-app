import { act } from '@testing-library/react';

import { useCondoScope } from '@/shared/lib/condo-scope';

import { applyLogin, signOutIfCondoMissing, useSessionStore } from './session-store';

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
    const role = applyLogin([
      { id: 'c1', name: 'Morada', role: 'resident' },
      { id: 'c2', name: 'Outro', role: 'admin' },
    ]);

    expect(role).toBe('resident');
    expect(useSessionStore.getState().role).toBe('resident');
    expect(useCondoScope.getState().condo).toEqual({ id: 'c1', name: 'Morada' });
  });

  test('signOut clears the condo', () => {
    applyLogin([{ id: 'c1', name: 'Morada', role: 'admin' }]);
    act(() => useSessionStore.getState().signOut());
    expect(useCondoScope.getState().condo).toBeNull();
  });

  test('boot with a session but no condo signs out', () => {
    act(() => useSessionStore.getState().authenticate('admin', null));
    act(() => useCondoScope.getState().setCondo(null));

    signOutIfCondoMissing();

    expect(useSessionStore.getState().role).toBeNull();
  });

  test('boot with a session and a condo keeps the session', () => {
    applyLogin([{ id: 'c1', name: 'Morada', role: 'admin' }]);

    signOutIfCondoMissing();

    expect(useSessionStore.getState().role).toBe('admin');
  });
});
