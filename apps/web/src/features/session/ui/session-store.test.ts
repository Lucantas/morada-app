import { act } from '@testing-library/react';

import { useSessionStore } from './session-store';

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
