import { createTestDb } from '../../../platform/db';
import type { DashboardSummary } from '../../domain/dashboard';
import { DashboardNotFoundError } from '../../domain/errors';

import { SqliteDashboardRepository } from './dashboard-repository';

const summary: DashboardSummary = {
  balance: { balanceCents: 100000, incomeCents: 250000, paidCents: 150000 },
  recentPaid: [{ id: 'p-1', label: 'Água', dateLabel: '01/07', valueCents: 5000, icon: 'water' }],
  maintenances: [{ id: 'm-1', title: 'Bomba', detail: 'Troca de bomba', icon: 'wrench' }],
};

describe('SqliteDashboardRepository', () => {
  test('getSummary parses the current row', () => {
    const db = createTestDb();
    db.prepare(`INSERT INTO dashboard (id, data) VALUES (?, ?)`).run(
      'current',
      JSON.stringify(summary),
    );

    const repo = new SqliteDashboardRepository(db);

    expect(repo.getSummary()).toEqual(summary);
  });

  test('getSummary throws DashboardNotFoundError when no row', () => {
    const repo = new SqliteDashboardRepository(createTestDb());

    expect(() => repo.getSummary()).toThrow(DashboardNotFoundError);
  });
});
