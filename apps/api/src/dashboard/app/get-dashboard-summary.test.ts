import type { DashboardSummary } from '../domain/dashboard';
import type { DashboardRepository } from '../domain/dashboard-repository';

import { getDashboardSummary } from './get-dashboard-summary';

const summary: DashboardSummary = {
  balance: { balanceCents: 100000, incomeCents: 250000, paidCents: 150000 },
  recentPaid: [
    { id: 'p-1', label: 'Água', dateLabel: '01/07', valueCents: 5000, icon: 'water' },
    { id: 'p-2', label: 'Energia', dateLabel: '02/07', valueCents: 8000, icon: 'bolt' },
  ],
  maintenances: [
    { id: 'm-1', title: 'Bomba', detail: 'Troca de bomba', icon: 'wrench' },
    { id: 'm-2', title: 'Fachada', detail: 'Pintura', icon: 'building2' },
  ],
};

function fakeRepo(value: DashboardSummary): DashboardRepository {
  return { getSummary: async () => value };
}

describe('getDashboardSummary', () => {
  test('returns the summary from the repository', async () => {
    expect(await getDashboardSummary(fakeRepo(summary))).toEqual(summary);
  });
});
