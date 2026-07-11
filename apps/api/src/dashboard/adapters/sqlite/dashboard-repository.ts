import type { Db } from '../../../platform/db';
import { dashboardSummarySchema, type DashboardSummary } from '../../domain/dashboard';
import type { DashboardRepository } from '../../domain/dashboard-repository';
import { DashboardNotFoundError } from '../../domain/errors';

interface DashboardRow {
  data: string;
}

function isDashboardRow(row: unknown): row is DashboardRow {
  return (
    typeof row === 'object' && row !== null && typeof (row as { data: unknown }).data === 'string'
  );
}

export class SqliteDashboardRepository implements DashboardRepository {
  constructor(private readonly db: Db) {}

  getSummary(): DashboardSummary {
    const row = this.db.prepare(`SELECT data FROM dashboard WHERE id = ?`).get('current');
    if (!isDashboardRow(row)) throw new DashboardNotFoundError();
    return dashboardSummarySchema.parse(JSON.parse(row.data));
  }
}
