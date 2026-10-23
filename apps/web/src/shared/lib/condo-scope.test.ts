import { act } from '@testing-library/react';

import { renderHook } from '@testing-library/react';

import { signOutIfCondoMissing, useSessionStore } from '@/features/session/ui/session-store';
import { testCondo } from '@/test/condo';

import { scopedApiPath, useCanDo, useCondoName, useCondoScope } from './condo-scope';

describe('scopedApiPath', () => {
  test('prefixes /api paths with the condominium', () => {
    expect(scopedApiPath('/api/residents', 'c1')).toBe('/api/condos/c1/residents');
  });

  test('leaves non-/api paths unchanged', () => {
    expect(scopedApiPath('/auth/logout', 'c1')).toBe('/auth/logout');
    expect(scopedApiPath('/me/condos', null)).toBe('/me/condos');
  });

  test('throws when an /api path has no condominium', () => {
    expect(() => scopedApiPath('/api/residents', null)).toThrow('Nenhum condomínio selecionado');
  });
});

describe('useCondoScope', () => {
  afterEach(() => act(() => useCondoScope.getState().setCondo(null)));

  test('starts without a condominium', () => {
    expect(useCondoScope.getState().condo).toBeNull();
  });

  test('setCondo stores it and rename changes only the name', () => {
    act(() => useCondoScope.getState().setCondo(testCondo({ name: 'Morada' })));
    act(() => useCondoScope.getState().rename('Novo'));
    expect(useCondoScope.getState().condo).toEqual(testCondo({ name: 'Novo' }));
  });

  test('rename is a no-op without a condominium', () => {
    act(() => useCondoScope.getState().rename('Novo'));
    expect(useCondoScope.getState().condo).toBeNull();
  });
});

describe('useCondoName', () => {
  afterEach(() => act(() => useCondoScope.getState().setCondo(null)));

  test('returns the current condominium name', () => {
    act(() => useCondoScope.getState().setCondo(testCondo()));

    const { result } = renderHook(() => useCondoName());

    expect(result.current).toBe('Residencial Ipê');
  });

  test('returns an empty string without a condominium', () => {
    const { result } = renderHook(() => useCondoName());

    expect(result.current).toBe('');
  });
});

describe('useCanDo', () => {
  afterEach(() => act(() => useCondoScope.getState().setCondo(null)));

  test('is true only for permissions the condominium grants', () => {
    act(() => useCondoScope.getState().setCondo(testCondo({ permissions: ['manage_money'] })));

    expect(renderHook(() => useCanDo('manage_money')).result.current).toBe(true);
    expect(renderHook(() => useCanDo('manage_fees')).result.current).toBe(false);
  });

  test('is false without a condominium', () => {
    expect(renderHook(() => useCanDo('manage_money')).result.current).toBe(false);
  });
});

describe('persisted condo from an older version', () => {
  afterEach(() => {
    localStorage.clear();
    act(() => useCondoScope.getState().setCondo(null));
  });

  test('drops a stored condo without permissions instead of crashing', async () => {
    localStorage.setItem(
      'morada-condo',
      JSON.stringify({ state: { condo: { id: 'c1', name: 'Morada' } }, version: 0 }),
    );

    await act(() => useCondoScope.persist.rehydrate());

    expect(useCondoScope.getState().condo).toBeNull();
    expect(renderHook(() => useCanDo('manage_fees')).result.current).toBe(false);
  });

  test('keeps a complete stored condo', async () => {
    const condo = testCondo();
    localStorage.setItem('morada-condo', JSON.stringify({ state: { condo }, version: 1 }));

    await act(() => useCondoScope.persist.rehydrate());

    expect(useCondoScope.getState().condo).toEqual(condo);
  });

  test('a logged-in session with an old stored condo is signed out', async () => {
    localStorage.setItem(
      'morada-condo',
      JSON.stringify({ state: { condo: { id: 'c1', name: 'Morada' } }, version: 0 }),
    );
    act(() => useSessionStore.getState().authenticate('admin', null));

    await act(() => useCondoScope.persist.rehydrate());
    signOutIfCondoMissing();

    expect(useSessionStore.getState().role).toBeNull();
  });
});
