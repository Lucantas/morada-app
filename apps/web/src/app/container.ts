import { InMemoryAccountRepository } from '@/features/accounts/data/in-memory-account-repository';
import { HttpAccountRepository } from '@/features/accounts/data/http-account-repository';
import { InMemoryDashboardRepository } from '@/features/dashboard/data/in-memory-dashboard-repository';
import { HttpDashboardRepository } from '@/features/dashboard/data/http-dashboard-repository';
import { InMemoryThreadRepository } from '@/features/messages/data/in-memory-thread-repository';
import { HttpThreadRepository } from '@/features/messages/data/http-thread-repository';
import { InMemoryNoticeRepository } from '@/features/notices/data/in-memory-notice-repository';
import { HttpNoticeRepository } from '@/features/notices/data/http-notice-repository';
import { InMemoryReceiptRepository } from '@/features/receipts/data/in-memory-receipt-repository';
import { HttpReceiptRepository } from '@/features/receipts/data/http-receipt-repository';
import { InMemoryResidentRepository } from '@/features/residents/data/in-memory-resident-repository';
import { HttpResidentRepository } from '@/features/residents/data/http-resident-repository';
import { resolveDemoLogin } from '@/features/session/domain/demo-login';
import type { Role } from '@/features/session/domain/session';
import { useSessionStore } from '@/features/session/ui/session-store';
import { createApiClient } from '@/shared/lib/api-client';
import { decodeJwtSubject } from '@/shared/lib/jwt';

import {
  accountSeed,
  dashboardSeed,
  noticeSeed,
  receiptSeed,
  residentSeed,
  threadSeed,
} from './seed';

const apiUrl = import.meta.env.VITE_API_URL;

/** Live API client (null in offline/in-memory mode). Reused by the HTTP
 *  repositories and by admin login provisioning. */
const apiClient = apiUrl
  ? createApiClient({ baseUrl: apiUrl, getToken: () => useSessionStore.getState().token })
  : null;

/** When VITE_API_URL is set the app runs against the live API; otherwise it uses
 *  seeded in-memory repositories (default for local demo and all tests). */
function buildRepositories() {
  if (apiClient) {
    const api = apiClient;
    return {
      residentRepository: new HttpResidentRepository(api),
      accountRepository: new HttpAccountRepository(api),
      receiptRepository: new HttpReceiptRepository(api),
      noticeRepository: new HttpNoticeRepository(api),
      threadRepository: new HttpThreadRepository(api),
      dashboardRepository: new HttpDashboardRepository(api),
    };
  }
  return {
    residentRepository: new InMemoryResidentRepository(residentSeed),
    accountRepository: new InMemoryAccountRepository(accountSeed),
    receiptRepository: new InMemoryReceiptRepository(receiptSeed),
    noticeRepository: new InMemoryNoticeRepository(noticeSeed),
    threadRepository: new InMemoryThreadRepository(threadSeed),
    dashboardRepository: new InMemoryDashboardRepository(dashboardSeed),
  };
}

export const {
  residentRepository,
  accountRepository,
  receiptRepository,
  noticeRepository,
  threadRepository,
  dashboardRepository,
} = buildRepositories();

/** Authenticate with a username and password, returning the resolved role.
 *  In API mode this calls POST /auth/login and stores the JWT (with the real
 *  subject decoded from it); offline it checks the seeded demo credentials. */
export async function login(username: string, password: string): Promise<Role> {
  if (!apiUrl) {
    const resolved = resolveDemoLogin(username, password);
    if (!resolved) throw new Error('Usuário ou senha inválidos.');
    useSessionStore.getState().signInAs(resolved.role, resolved.subject);
    return resolved.role;
  }
  const res = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (res.status === 401) throw new Error('Usuário ou senha inválidos.');
  if (!res.ok) throw new Error('Não foi possível entrar. Verifique a conexão com o servidor.');
  const data = (await res.json()) as { token: string; role: Role };
  useSessionStore.getState().authenticate(data.role, data.token, decodeJwtSubject(data.token));
  return data.role;
}

/** Admin-only: provision a resident login. In API mode this calls the live
 *  endpoint (which generates and returns a one-time temp password). Offline it
 *  returns a locally generated temp password so the demo flow still works. */
export async function provisionResidentLogin(input: {
  username: string;
  residentId: string;
}): Promise<{ username: string; tempPassword: string }> {
  if (!apiClient) {
    return { username: input.username, tempPassword: offlineTempPassword() };
  }
  const data = (await apiClient.post('/api/users', input)) as {
    username: string;
    tempPassword: string;
  };
  return { username: data.username, tempPassword: data.tempPassword };
}

function offlineTempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
