import { HttpAccountRepository } from '@/features/accounts/data/http-account-repository';
import { HttpDashboardRepository } from '@/features/dashboard/data/http-dashboard-repository';
import { HttpThreadRepository } from '@/features/messages/data/http-thread-repository';
import { HttpNoticeRepository } from '@/features/notices/data/http-notice-repository';
import { HttpReceiptRepository } from '@/features/receipts/data/http-receipt-repository';
import { HttpResidentRepository } from '@/features/residents/data/http-resident-repository';
import { HttpSettingsRepository } from '@/features/settings/data/http-settings-repository';
import type { Role } from '@/features/session/domain/session';
import { useSessionStore } from '@/features/session/ui/session-store';
import { createApiClient } from '@/shared/lib/api-client';
import { decodeJwtSubject } from '@/shared/lib/jwt';

// The app always talks to the real API. Point it elsewhere with VITE_API_URL;
// it defaults to the local API from `make start` / `make start-backend`.
const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';

const apiClient = createApiClient({
  baseUrl: apiUrl,
  getToken: () => useSessionStore.getState().token,
  onUnauthorized: () => useSessionStore.getState().signOut(),
});

export const residentRepository = new HttpResidentRepository(apiClient);
export const accountRepository = new HttpAccountRepository(apiClient);
export const receiptRepository = new HttpReceiptRepository(apiClient);
export const noticeRepository = new HttpNoticeRepository(apiClient);
export const threadRepository = new HttpThreadRepository(apiClient);
export const dashboardRepository = new HttpDashboardRepository(apiClient);
export const settingsRepository = new HttpSettingsRepository(apiClient);

/** Authenticate with a username and password against the API, storing the JWT
 *  (with the real subject decoded from it) and returning the resolved role. */
export async function login(username: string, password: string): Promise<Role> {
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

/** Admin-only: issue a pending charge (receipt) to a resident. Optionally
 *  mark it already paid by providing both `paidAt` and `method`. */
export async function issueCharge(input: {
  residentId: string;
  ref: string;
  title: string;
  valueCents: number;
  dueDate: string;
  paidAt?: string;
  method?: 'dinheiro' | 'pix';
}): Promise<void> {
  await apiClient.post('/api/receipts', input);
}

/** Admin-only: edit an existing receipt's ref/title/value/due date. */
export async function editReceipt(input: {
  receiptId: string;
  ref: string;
  title: string;
  valueCents: number;
  dueDate: string;
}): Promise<void> {
  const { receiptId, ...patch } = input;
  await apiClient.put(`/api/receipts/${receiptId}`, patch);
}

/** Admin-only: register a payment against a receipt, informing when it was paid. */
export async function registerPayment(input: {
  receiptId: string;
  method: 'dinheiro' | 'pix';
  paidAt: string;
}): Promise<void> {
  await apiClient.post(`/api/receipts/${input.receiptId}/pay`, {
    method: input.method,
    paidAt: input.paidAt,
  });
}

/** Admin-only: confirm a resident-submitted payment, marking the receipt paid. */
export async function confirmPayment(input: { receiptId: string; paidAt?: string }): Promise<void> {
  await apiClient.post(
    `/api/receipts/${input.receiptId}/confirm`,
    input.paidAt ? { paidAt: input.paidAt } : {},
  );
}

/** Admin-only: reject a resident-submitted payment, returning the receipt to pendente. */
export async function rejectPayment(receiptId: string): Promise<void> {
  await apiClient.post(`/api/receipts/${receiptId}/reject`, {});
}

/** Admin-only: ensure every active resident has the current month's condo-fee
 *  charge. Idempotent; safe to call on each admin load. */
export async function ensureMonthlyReceipts(): Promise<void> {
  await apiClient.post('/api/receipts/ensure-month', {});
}

/** Admin-only: override a resident's payment status, or clear it (null → derived). */
export async function overrideResidentStatus(input: {
  residentId: string;
  status: 'em_dia' | 'pendente' | 'atrasado' | null;
}): Promise<void> {
  await residentRepository.setStatusOverride(input.residentId, input.status);
}

/** Admin-only: provision a resident login. The API generates and returns the
 *  one-time temp password. */
export async function provisionResidentLogin(input: {
  username: string;
  residentId: string;
}): Promise<{ username: string; tempPassword: string }> {
  const data = (await apiClient.post('/api/users', input)) as {
    username: string;
    tempPassword: string;
  };
  return { username: data.username, tempPassword: data.tempPassword };
}
