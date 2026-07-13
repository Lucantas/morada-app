import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

import { buildResident } from '@/test/factories';

import { InMemoryResidentRepository } from '../data/in-memory-resident-repository';

import { useCurrentResident } from './use-current-resident';

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useCurrentResident', () => {
  test('resolves the resident matching the session subject', async () => {
    const repository = new InMemoryResidentRepository([
      buildResident({ id: 'r-1', name: 'Maria Ribeiro' }),
      buildResident({ id: 'r-2', name: 'João Pereira' }),
    ]);

    const { result } = renderHook(() => useCurrentResident(repository, 'r-1'), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe('Maria Ribeiro');
  });

  test('does not fetch while the subject is null', () => {
    const repository = new InMemoryResidentRepository([buildResident({ id: 'r-1' })]);
    const { result } = renderHook(() => useCurrentResident(repository, null), {
      wrapper: wrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });
});
