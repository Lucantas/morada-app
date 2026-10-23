import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { useCondoScope } from '@/shared/lib/condo-scope';
import { clearTestCondo, setTestCondo, TEST_CONDO_NAME } from '@/test/condo';

import { InMemoryCondoInfoRepository } from '../data/in-memory-condo-info-repository';

import { useCondoInfo, useRenameCondo } from './use-condo-info';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('condo info hooks', () => {
  afterEach(() => clearTestCondo());

  test('useCondoInfo loads the condominium once a condo is selected', async () => {
    setTestCondo();
    const repo = new InMemoryCondoInfoRepository({ id: 'c1', name: TEST_CONDO_NAME });

    const { result } = renderHook(() => useCondoInfo(repo), { wrapper });

    await waitFor(() => expect(result.current.data?.name).toBe(TEST_CONDO_NAME));
  });

  test('useCondoInfo stays idle without a selected condo', () => {
    const repo = new InMemoryCondoInfoRepository({ id: 'c1', name: TEST_CONDO_NAME });

    const { result } = renderHook(() => useCondoInfo(repo), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  test('useRenameCondo pushes the new name into the condo scope', async () => {
    setTestCondo();
    const repo = new InMemoryCondoInfoRepository({ id: 'c1', name: TEST_CONDO_NAME });
    const { result } = renderHook(() => useRenameCondo(repo), { wrapper });

    await act(() => result.current.mutateAsync('Edifício Aurora'));

    expect(useCondoScope.getState().condo?.name).toBe('Edifício Aurora');
  });
});
