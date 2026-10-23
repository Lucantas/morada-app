import { act } from '@testing-library/react';

import { scopedApiPath, useCondoScope } from './condo-scope';

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
    act(() => useCondoScope.getState().setCondo({ id: 'c1', name: 'Morada' }));
    act(() => useCondoScope.getState().rename('Novo'));
    expect(useCondoScope.getState().condo).toEqual({ id: 'c1', name: 'Novo' });
  });

  test('rename is a no-op without a condominium', () => {
    act(() => useCondoScope.getState().rename('Novo'));
    expect(useCondoScope.getState().condo).toBeNull();
  });
});
