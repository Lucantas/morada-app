import type { DashboardSummary } from '../domain/dashboard';
import type { DashboardRepository } from '../domain/dashboard-repository';

import { toDashboardSummary } from './dashboard-row';

export class InMemoryDashboardRepository implements DashboardRepository {
  private readonly summary: DashboardSummary;

  constructor(seed: unknown) {
    this.summary = toDashboardSummary(seed);
  }

  async getSummary(): Promise<DashboardSummary> {
    return this.summary;
  }
}
