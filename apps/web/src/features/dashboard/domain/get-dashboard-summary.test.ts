import { buildDashboardSummary } from '@/test/factories.dashboard';

import { InMemoryDashboardRepository } from '../data/in-memory-dashboard-repository';

import { getDashboardSummary } from './get-dashboard-summary';

describe('getDashboardSummary', () => {
  test('returns the summary provided by the repository', async () => {
    const summary = buildDashboardSummary({
      balance: { balanceCents: 500, incomeCents: 300, paidCents: 200 },
    });
    const repository = new InMemoryDashboardRepository(summary);

    expect(await getDashboardSummary(repository)).toEqual(summary);
  });
});
