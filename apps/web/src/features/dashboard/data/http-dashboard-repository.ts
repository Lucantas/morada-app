import type { ApiClient } from '@/shared/lib/api-client';

import { dashboardSummarySchema, type DashboardSummary } from '../domain/dashboard';
import type { DashboardRepository } from '../domain/dashboard-repository';

export class HttpDashboardRepository implements DashboardRepository {
  constructor(private readonly api: ApiClient) {}

  async getSummary(): Promise<DashboardSummary> {
    return dashboardSummarySchema.parse(await this.api.get('/api/dashboard'));
  }
}
