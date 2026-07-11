import { buildDashboardSummary } from '@/test/factories.dashboard';

import { InMemoryDashboardRepository } from './in-memory-dashboard-repository';

describe('InMemoryDashboardRepository', () => {
  test('parses the seed and returns the summary from getSummary', async () => {
    const summary = buildDashboardSummary();
    const repository = new InMemoryDashboardRepository(summary);

    expect(await repository.getSummary()).toEqual(summary);
  });

  test('rejects malformed seed data at the boundary', () => {
    expect(() => new InMemoryDashboardRepository({ balance: { balanceCents: 1 } })).toThrow();
  });
});
