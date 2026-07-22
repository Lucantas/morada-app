import { HttpAccountRepository } from '@/features/accounts/data/http-account-repository';
import { HttpCategoryRepository } from '@/features/categories/data/http-category-repository';
import { HttpDashboardRepository } from '@/features/dashboard/data/http-dashboard-repository';
import { HttpIncomeRepository } from '@/features/income/data/http-income-repository';
import { HttpThreadRepository } from '@/features/messages/data/http-thread-repository';
import { HttpNoticeRepository } from '@/features/notices/data/http-notice-repository';
import { HttpReceiptRepository } from '@/features/receipts/data/http-receipt-repository';
import { HttpResidentRepository } from '@/features/residents/data/http-resident-repository';
import { HttpSettingsRepository } from '@/features/settings/data/http-settings-repository';
import type { Role } from '@/features/session/domain/session';
import { useSessionStore } from '@/features/session/ui/session-store';
import { createApiClient } from '@/shared/lib/api-client';

// The app always talks to the real API. Point it elsewhere with VITE_API_URL;
// it defaults to the local API from `make start` / `make start-backend`.
const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';

const apiClient = createApiClient({
  baseUrl: apiUrl,
  onUnauthorized: () => useSessionStore.getState().signOut(),
});

export const residentRepository = new HttpResidentRepository(apiClient);
export const accountRepository = new HttpAccountRepository(apiClient);
export const receiptRepository = new HttpReceiptRepository(apiClient);
export const noticeRepository = new HttpNoticeRepository(apiClient);
export const threadRepository = new HttpThreadRepository(apiClient);
export const dashboardRepository = new HttpDashboardRepository(apiClient);
export const settingsRepository = new HttpSettingsRepository(apiClient);
export const categoryRepository = new HttpCategoryRepository(apiClient);
export const incomeRepository = new HttpIncomeRepository(apiClient);

/** Authenticate with a username and password against the API. The API sets the
 *  session cookie; the body only carries the role and subject to store. */
export async function login(username: string, password: string): Promise<Role> {
  const res = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (res.status === 401) throw new Error('Usuário ou senha inválidos.');
  if (!res.ok) throw new Error('Não foi possível entrar. Verifique a conexão com o servidor.');
  const data = (await res.json()) as { role: Role; subject: string | null };
  useSessionStore.getState().authenticate(data.role, data.subject);
  return data.role;
}

/** Sign out: tell the server to clear the session cookie, then clear local state
 *  regardless of whether the server call succeeds. */
export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } catch {
    // server-side session cleanup is best-effort; the cookie expires on its own
  } finally {
    useSessionStore.getState().signOut();
  }
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
  proofDataUrl?: string;
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

/** Admin-only: fetch a resident's existing login, or null when none exists. */
export async function getResidentLogin(residentId: string): Promise<{ username: string } | null> {
  const data = (await apiClient.get(`/api/residents/${residentId}/login`)) as {
    username: string;
  } | null;
  return data ? { username: data.username } : null;
}

/** Admin-only: reset a resident's login password. The API returns a fresh
 *  one-time temp password. */
export async function resetResidentLogin(
  residentId: string,
): Promise<{ username: string; tempPassword: string }> {
  const data = (await apiClient.post(`/api/residents/${residentId}/login/reset`, {})) as {
    username: string;
    tempPassword: string;
  };
  return { username: data.username, tempPassword: data.tempPassword };
}
