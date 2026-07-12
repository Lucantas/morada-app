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

  test('authenticate stores role, token and subject; signOut clears all', () => {
    act(() => useSessionStore.getState().authenticate('resident', 'jwt-abc', 'r-1'));
    expect(useSessionStore.getState()).toMatchObject({
      role: 'resident',
      token: 'jwt-abc',
      subject: 'r-1',
    });
    act(() => useSessionStore.getState().signOut());
    expect(useSessionStore.getState()).toMatchObject({ role: null, token: null, subject: null });
  });

  test('signInAs records the offline subject', () => {
    act(() => useSessionStore.getState().signInAs('resident', 'r-1'));
    expect(useSessionStore.getState()).toMatchObject({ role: 'resident', subject: 'r-1' });
  });
});
