import { act } from '@testing-library/react';

import { useSessionStore } from './session-store';

describe('useSessionStore', () => {
  afterEach(() => act(() => useSessionStore.getState().signOut()));

  test('starts signed out', () => {
    expect(useSessionStore.getState().role).toBeNull();
  });

  test('signInAs sets the role', () => {
    act(() => useSessionStore.getState().signInAs('admin'));
    expect(useSessionStore.getState().role).toBe('admin');
  });

  test('signOut clears the role', () => {
    act(() => useSessionStore.getState().signInAs('resident'));
    act(() => useSessionStore.getState().signOut());
    expect(useSessionStore.getState().role).toBeNull();
  });

  test('authenticate stores the role and token; signOut clears both', () => {
    act(() => useSessionStore.getState().authenticate('admin', 'jwt-abc'));
    expect(useSessionStore.getState()).toMatchObject({ role: 'admin', token: 'jwt-abc' });
    act(() => useSessionStore.getState().signOut());
    expect(useSessionStore.getState()).toMatchObject({ role: null, token: null });
  });
});
