import { Hono } from 'hono';

import type { DashboardSummary } from '../../domain/dashboard';
import type { DashboardRepository } from '../../domain/dashboard-repository';

import { dashboardRoutes } from './routes';

const summary: DashboardSummary = {
  balance: { balanceCents: 100000, incomeCents: 250000, paidCents: 150000 },
  recentPaid: [{ id: 'p-1', label: 'Água', dateLabel: '01/07', valueCents: 5000, icon: 'water' }],
  maintenances: [{ id: 'm-1', title: 'Bomba', detail: 'Troca de bomba', icon: 'wrench' }],
};

function fakeRepo(value: DashboardSummary): DashboardRepository {
  return { getSummary: () => value };
}

describe('dashboardRoutes', () => {
  test('GET / returns 200 with the summary', async () => {
    const app = new Hono();
    app.route('/', dashboardRoutes(fakeRepo(summary)));

    const res = await app.request('/');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(summary);
  });
});
