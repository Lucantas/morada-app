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
import type { Role } from '@/features/session/domain/session';
import { useSessionStore } from '@/features/session/ui/session-store';
import { createApiClient } from '@/shared/lib/api-client';

import {
  accountSeed,
  dashboardSeed,
  noticeSeed,
  receiptSeed,
  residentSeed,
  threadSeed,
} from './seed';

const apiUrl = import.meta.env.VITE_API_URL;

/** When VITE_API_URL is set the app runs against the live API; otherwise it uses
 *  seeded in-memory repositories (default for local demo and all tests). */
function buildRepositories() {
  if (apiUrl) {
    const api = createApiClient({
      baseUrl: apiUrl,
      getToken: () => useSessionStore.getState().token,
    });
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

/** Authenticate. In API mode this calls POST /auth/login and stores the JWT;
 *  in in-memory mode it just records the chosen role. */
export async function login(role: Role): Promise<void> {
  if (!apiUrl) {
    useSessionStore.getState().signInAs(role);
    return;
  }
  const res = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error('Não foi possível entrar. Verifique a conexão com o servidor.');
  const data = (await res.json()) as { token: string };
  useSessionStore.getState().authenticate(role, data.token);
}
