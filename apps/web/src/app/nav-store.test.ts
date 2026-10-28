import { act } from '@testing-library/react';

import { useNavStore } from './nav-store';

describe('useNavStore', () => {
  afterEach(() => act(() => useNavStore.getState().go('a-home')));

  test('go sets the view and context params', () => {
    act(() => useNavStore.getState().go('a-resident-edit', { residentId: 'r-9' }));
    expect(useNavStore.getState()).toMatchObject({ view: 'a-resident-edit', residentId: 'r-9' });
  });

  test('go clears context params when none are passed', () => {
    act(() => useNavStore.getState().go('a-resident-edit', { residentId: 'r-9' }));
    act(() => useNavStore.getState().go('a-accounts'));
    expect(useNavStore.getState().residentId).toBeUndefined();
    expect(useNavStore.getState().incomeId).toBeUndefined();
  });

  test('go keeps the apartment label and clears it on the next go', () => {
    act(() => useNavStore.getState().go('a-resident-edit', { apt: 'Apto 101' }));
    expect(useNavStore.getState().apt).toBe('Apto 101');
    act(() => useNavStore.getState().go('a-residents'));
    expect(useNavStore.getState().apt).toBeUndefined();
  });

  test('restore applies a snapshot view and params', () => {
    act(() => useNavStore.getState().restore({ view: 'r-pay', residentId: 'c-2' }));
    expect(useNavStore.getState()).toMatchObject({ view: 'r-pay', residentId: 'c-2' });
  });
});
