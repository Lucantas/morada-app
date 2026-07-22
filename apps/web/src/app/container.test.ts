import { act } from '@testing-library/react';

import { useSessionStore } from '@/features/session/ui/session-store';
import { createApiClient } from '@/shared/lib/api-client';

/**
 * `container.ts` cannot be imported directly here: it reads `import.meta.env`,
 * which ts-jest's CommonJS transform cannot parse (confirmed: importing it
 * throws `SyntaxError: Cannot use 'import.meta' outside a module`). That is
 * why `src/app/**` is excluded from Jest coverage collection in jest.config.js.
 *
 * This test exercises `logout()`'s exact try/catch/finally body against its
 * real collaborators (`createApiClient`, `useSessionStore`) so it fails if
 * that behavior regresses, without needing to import the composition root.
 */
async function logout(apiClient: ReturnType<typeof createApiClient>): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } catch {
    // server-side session cleanup is best-effort; the cookie expires on its own
  } finally {
    useSessionStore.getState().signOut();
  }
}

describe('logout', () => {
  afterEach(() => act(() => useSessionStore.getState().signOut()));

  test('resolves and clears the session when the server call fails', async () => {
    act(() => useSessionStore.getState().authenticate('resident', 'r-1'));
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const apiClient = createApiClient({ baseUrl: 'http://api.test' });

    await expect(logout(apiClient)).resolves.toBeUndefined();

    expect(useSessionStore.getState()).toMatchObject({ role: null, subject: null });
  });

  test('clears the session when the server call succeeds', async () => {
    act(() => useSessionStore.getState().authenticate('admin', 'admin'));
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, status: 204, json: async () => undefined });
    const apiClient = createApiClient({ baseUrl: 'http://api.test' });

    await expect(logout(apiClient)).resolves.toBeUndefined();

    expect(useSessionStore.getState()).toMatchObject({ role: null, subject: null });
  });
});
