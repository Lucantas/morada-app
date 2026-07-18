import { act } from '@testing-library/react';

import { startNavHistory } from './nav-history';
import { useNavStore } from './nav-store';

describe('startNavHistory', () => {
  let stop: (() => void) | undefined;

  beforeEach(() => act(() => useNavStore.getState().go('a-home')));
  afterEach(() => {
    stop?.();
    stop = undefined;
    act(() => useNavStore.getState().go('a-home'));
  });

  test('pushes a history entry when the view changes', () => {
    const push = jest.spyOn(window.history, 'pushState');
    stop = startNavHistory();
    act(() => useNavStore.getState().go('a-accounts', { residentId: 'x-1' }));
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ view: 'a-accounts', residentId: 'x-1' }),
      '',
    );
    push.mockRestore();
  });

  test('does not push when the destination equals the current view', () => {
    stop = startNavHistory();
    const push = jest.spyOn(window.history, 'pushState');
    act(() => useNavStore.getState().go('a-home'));
    expect(push).not.toHaveBeenCalled();
    push.mockRestore();
  });

  test('restores the view on popstate without pushing again', () => {
    stop = startNavHistory();
    act(() => useNavStore.getState().go('a-accounts'));
    const push = jest.spyOn(window.history, 'pushState');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { view: 'a-home' } }));
    });
    expect(useNavStore.getState().view).toBe('a-home');
    expect(push).not.toHaveBeenCalled();
    push.mockRestore();
  });

  test('does not push after cleanup', () => {
    stop = startNavHistory();
    stop();
    stop = undefined;
    const push = jest.spyOn(window.history, 'pushState');
    act(() => useNavStore.getState().go('r-receipts'));
    expect(push).not.toHaveBeenCalled();
    push.mockRestore();
  });
});
